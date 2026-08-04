/**
 * backfill-realistic-contacts.ts
 *
 * Demo-data-realism pass, Part 1 + 2a (see the plan file for full context):
 *
 * Part 1 - Buyer/Seller contact fields that read as obviously synthetic:
 *   - 31 buyers ("<City> Investor <N>") use `@example.com` - a reserved,
 *     non-deliverable RFC 2606 domain.
 *   - 55 sellers (every scraper-created one) use `@hublet.scraped` - not a
 *     real TLD.
 *   - 80 buyers + 85 sellers have a sequential placeholder phone
 *     (`9100000XX` / `9200000XX` / `9300000XX`) or, for scraped sellers, a
 *     literal `0000000000`.
 * Only the field that's actually fake gets touched per record - name,
 * rating, trustScore, completedDeals, passwordHash, sellerType are all
 * left alone. `Test Locality Buyer` (leftover rehearsal test data) is
 * explicitly excluded via its own email.
 *
 * Part 2a - Property.contact is null on all 110 properties, rendered as a
 * literal "N/A" in the Admin Properties table for every row. Backfilled
 * from the property's own real `seller` relation (name + phone) - using
 * the *new*, realistic seller phone computed by Part 1 above, not the old
 * fake one, since both run in the same pass.
 *
 * Neither part invents a real person's real contact info - domains/phone
 * prefixes are drawn from realistic pools, not looked up online, since the
 * subject here is private individuals (see the plan's "where research is
 * and isn't used" section).
 *
 * Log shape (consumed by restore-from-backfill-log.ts):
 *   { apply, updated, rows: [{ table, id, name, changes: [{field, prior, new}] }] }
 *
 * Safety: dry-run by default. Pass --apply to write.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-realistic-contacts.ts            # dry run
 *   npx tsx src/scripts/backfill-realistic-contacts.ts --apply     # real backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const FAKE_PHONE_RE = /^9[123]0{6}\d{2}$/; // e.g. 9100000050, 9200000005, 9300000002
const ALL_ZERO_PHONE = '0000000000';
const FAKE_EMAIL_DOMAINS = ['hublet.scraped', 'example.com'];
const EXCLUDED_EMAILS = new Set(['test.locality.buyer@example.com']); // leftover rehearsal test data - not a realism candidate

const DOMAIN_WEIGHTS: Array<[string, number]> = [
    ['gmail.com', 70],
    ['yahoo.com', 15],
    ['outlook.com', 10],
    ['rediffmail.com', 5],
];

function pickDomain(): string {
    const total = DOMAIN_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [domain, weight] of DOMAIN_WEIGHTS) {
        if (r < weight) return domain;
        r -= weight;
    }
    return 'gmail.com';
}

function slugifyName(name: string): string[] {
    return name
        .toLowerCase()
        .replace(/\(.*?\)/g, ' ') // drop "(Owner)" style suffixes
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function buildLocalPart(name: string): string {
    // Special case: "<City> Investor <N>" - keep the number appended without
    // a dot so the 31 investor emails stay naturally distinct instead of
    // colliding into "<city>.investor@gmail.com" x10.
    const investorMatch = name.match(/^(.+?)\s+Investor\s+(\d+)$/i);
    if (investorMatch) {
        const words = slugifyName(investorMatch[1]);
        const base = words.length > 0 ? words[0] : 'investor';
        return `${base}.investor${investorMatch[2]}`;
    }

    const words = slugifyName(name);
    if (words.length === 0) return 'contact';
    if (words.length === 1) return words[0];
    return `${words[0]}.${words[1]}`;
}

function isFakeEmail(email: string): boolean {
    if (EXCLUDED_EMAILS.has(email)) return false;
    return FAKE_EMAIL_DOMAINS.some((d) => email.endsWith(`@${d}`));
}

function isFakePhone(phone: string | null): boolean {
    if (!phone) return false; // leave nulls alone - not in scope (e.g. Test Locality Buyer)
    return phone === ALL_ZERO_PHONE || FAKE_PHONE_RE.test(phone);
}

function randomPhone(): string {
    for (let attempt = 0; attempt < 20; attempt++) {
        const first = [6, 7, 8, 9][Math.floor(Math.random() * 4)];
        let rest = '';
        for (let i = 0; i < 9; i++) rest += Math.floor(Math.random() * 10);
        const candidate = `${first}${rest}`;
        const allSame = new Set(candidate.split('')).size === 1;
        const isSequential = /0123456789|9876543210/.test(candidate);
        const isPlaceholderLike = FAKE_PHONE_RE.test(candidate) || candidate === ALL_ZERO_PHONE;
        if (!allSame && !isSequential && !isPlaceholderLike) return `+91 ${candidate}`;
    }
    throw new Error('Failed to generate a non-synthetic-looking phone number after 20 attempts');
}

function buildEmail(name: string, usedEmails: Set<string>): string {
    const base = buildLocalPart(name);
    let candidate = `${base}@${pickDomain()}`;
    let suffix = 1;
    while (usedEmails.has(candidate)) {
        candidate = `${base}${100 + suffix}@${pickDomain()}`;
        suffix++;
    }
    usedEmails.add(candidate);
    return candidate;
}

interface ChangeEntry { field: string; prior: any; new: any; }
interface Row { table: 'buyer' | 'seller' | 'property'; id: string; name: string; changes: ChangeEntry[]; }

export async function backfillRealisticContacts(
    prisma: PrismaClient,
    apply: boolean
): Promise<{ updated: number; rows: Row[] }> {
    const buyers = await prisma.buyer.findMany({ select: { id: true, name: true, email: true, phone: true } });
    const sellers = await prisma.seller.findMany({ select: { id: true, name: true, email: true, phone: true } });
    const properties = await prisma.property.findMany({ select: { id: true, title: true, contact: true, sellerId: true } });

    const usedBuyerEmails = new Set(buyers.map((b) => b.email));
    const usedSellerEmails = new Set(sellers.map((s) => s.email));

    const rows: Row[] = [];

    // --- Part 1: Buyer ---
    for (const buyer of buyers) {
        const emailFake = isFakeEmail(buyer.email);
        const phoneFake = isFakePhone(buyer.phone);
        if (!emailFake && !phoneFake) continue;

        const changes: ChangeEntry[] = [];
        if (emailFake) changes.push({ field: 'email', prior: buyer.email, new: buildEmail(buyer.name, usedBuyerEmails) });
        if (phoneFake) changes.push({ field: 'phone', prior: buyer.phone, new: randomPhone() });

        rows.push({ table: 'buyer', id: buyer.id, name: buyer.name, changes });
    }

    // --- Part 1: Seller (track new phone/name in memory for Part 2a below) ---
    const sellerNewPhone = new Map<string, string>(); // sellerId -> new phone (or existing if unchanged)
    for (const seller of sellers) sellerNewPhone.set(seller.id, seller.phone || '');

    for (const seller of sellers) {
        const emailFake = isFakeEmail(seller.email);
        const phoneFake = isFakePhone(seller.phone);
        if (!emailFake && !phoneFake) continue;

        const changes: ChangeEntry[] = [];
        if (emailFake) changes.push({ field: 'email', prior: seller.email, new: buildEmail(seller.name, usedSellerEmails) });
        if (phoneFake) {
            const newPhone = randomPhone();
            changes.push({ field: 'phone', prior: seller.phone, new: newPhone });
            sellerNewPhone.set(seller.id, newPhone);
        }

        rows.push({ table: 'seller', id: seller.id, name: seller.name, changes });
    }

    // --- Part 2a: Property.contact, using the (possibly just-updated) seller phone ---
    const sellerById = new Map(sellers.map((s) => [s.id, s]));
    for (const property of properties) {
        if (property.contact) continue; // already has something - don't overwrite
        const seller = sellerById.get(property.sellerId);
        if (!seller) continue; // orphaned property, skip
        const phone = sellerNewPhone.get(property.sellerId) || seller.phone;
        if (!phone) continue; // seller itself has no phone at all - nothing to compose from

        const newContact = `${seller.name} · ${phone}`;
        rows.push({
            table: 'property',
            id: property.id,
            name: property.title,
            changes: [{ field: 'contact', prior: property.contact, new: newContact }],
        });
    }

    if (apply) {
        for (const row of rows) {
            const data: Record<string, any> = {};
            for (const c of row.changes) data[c.field] = c.new;
            if (row.table === 'buyer') await prisma.buyer.update({ where: { id: row.id }, data });
            else if (row.table === 'seller') await prisma.seller.update({ where: { id: row.id }, data });
            else await prisma.property.update({ where: { id: row.id }, data });
        }
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(
        logDir,
        `realistic-contacts-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(logPath, JSON.stringify({ apply, updated: rows.length, rows }, null, 2));

    console.log(`[backfill-realistic-contacts] ${apply ? 'APPLIED' : 'DRY RUN'} - changed: ${rows.length}`);
    console.log(`[backfill-realistic-contacts] Audit log written to ${logPath}`);

    return { updated: rows.length, rows };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    const prisma = new PrismaClient();
    backfillRealisticContacts(prisma, apply)
        .then((result) => {
            for (const row of result.rows) {
                const changeStr = row.changes.map((c) => `${c.field}: ${JSON.stringify(c.prior)} -> ${JSON.stringify(c.new)}`).join(' | ');
                console.log(`[${row.table}] ${row.id.slice(0, 8)} | ${row.name.padEnd(35)} | ${changeStr}`);
            }
            console.log(`\nTotal changed: ${result.updated}`);
            process.exit(0);
        })
        .catch((err) => {
            console.error('FATAL:', err);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}
