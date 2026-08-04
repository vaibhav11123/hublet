/**
 * backfill-realistic-contacts-v2.ts
 *
 * Round 2, Part 1 (see the plan file for full context).
 *
 * v1 (backfill-realistic-contacts.ts) fixed fake *domains* (@example.com,
 * @hublet.scraped) but generated every replacement local-part from a single
 * rigid template ("firstword.secondword"). The result: literally every one
 * of 196 buyer+seller emails - including the ~30 that were already on a
 * real domain before v1 ever ran - follows exactly one of two shapes
 * (firstname.lastname@domain or singleword@domain), zero numbers, zero
 * underscores, zero variation. That total uniformity is itself the tell.
 *
 * This script regenerates ALL in-scope emails using one of six weighted
 * patterns per record, so no single shape dominates:
 *   1. first.last + 2-digit number          - 30%
 *   2. firstlast + 2-4 digit number          - 20%
 *   3. first.last, no number                 - 20%
 *   4. firstinitial + last + number          - 15%
 *   5. first_last, optional number            - 10%
 *   6. first + number only (1-word names)    - 5%
 *
 * Special case: the 30 "<City> Investor <N>" buyers had their old email
 * literally spell out "investor" + a sequential number - the single
 * biggest tell. That word is dropped entirely; the local part is instead
 * drawn from a small pool of realistic Indian first/last names (the
 * buyer's display `name` field is NOT touched, per explicit instruction -
 * only the email changes).
 *
 * Excluded entirely: rahul.blr@gmail.com and adani.amd@gmail.com (the
 * professor demo-email accounts - must keep logging in unchanged), and
 * test.locality.buyer@example.com (leftover rehearsal test data).
 *
 * Log shape (consumed by restore-from-backfill-log.ts):
 *   { apply, updated, rows: [{ table, id, name, changes: [{field, prior, new}] }] }
 *
 * Safety: dry-run by default. Pass --apply to write.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-realistic-contacts-v2.ts            # dry run
 *   npx tsx src/scripts/backfill-realistic-contacts-v2.ts --apply     # real backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const EXCLUDED_EMAILS = new Set([
    'rahul.blr@gmail.com',
    'adani.amd@gmail.com',
    'test.locality.buyer@example.com',
]);

const DOMAIN_WEIGHTS: Array<[string, number]> = [
    ['gmail.com', 70],
    ['yahoo.com', 15],
    ['outlook.com', 10],
    ['rediffmail.com', 5],
];

const INVESTOR_FIRST_NAMES = [
    'Rohit', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Karan', 'Divya', 'Suresh', 'Meena',
    'Arjun', 'Pooja', 'Nikhil', 'Kavya', 'Rajesh', 'Swati', 'Manoj', 'Neha', 'Sandeep', 'Ritu',
    'Ashok', 'Deepika', 'Vivek', 'Shalini', 'Gaurav',
];
const INVESTOR_LAST_NAMES = [
    'Sharma', 'Verma', 'Gupta', 'Reddy', 'Iyer', 'Nair', 'Menon', 'Rao', 'Bhat', 'Joshi',
    'Malhotra', 'Chopra', 'Kapoor', 'Desai', 'Shetty', 'Pillai', 'Agarwal', 'Bose', 'Chatterjee', 'Pandey',
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
        .replace(/\(.*?\)/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

function randomNumber(): string {
    // 70% chance a short 2-digit number, 30% chance a birth-year-style 4-digit number.
    if (Math.random() < 0.7) return String(18 + Math.floor(Math.random() * 82)); // 18-99
    return String(1980 + Math.floor(Math.random() * 26)); // 1980-2005
}

type Pattern = 1 | 2 | 3 | 4 | 5 | 6;

function pickPattern(hasLast: boolean): Pattern {
    // Patterns needing a "last" word fall back to pattern 6 when there isn't one.
    if (!hasLast) return 6;
    const r = Math.random() * 100;
    if (r < 30) return 1;
    if (r < 50) return 2;
    if (r < 70) return 3;
    if (r < 85) return 4;
    if (r < 95) return 5;
    return 6;
}

function buildLocalPart(first: string, last: string | null): string {
    const pattern = pickPattern(!!last);
    switch (pattern) {
        case 1: return `${first}.${last}${randomNumber()}`;
        case 2: return `${first}${last}${randomNumber()}`;
        case 3: return `${first}.${last}`;
        case 4: return `${first[0]}${last}${randomNumber()}`;
        case 5: return Math.random() < 0.5 ? `${first}_${last}` : `${first}_${last}${randomNumber()}`;
        case 6: return `${first}${randomNumber()}`;
    }
}

function buildEmailFromWords(words: string[], usedEmails: Set<string>): string {
    const first = words[0] || 'contact';
    const last = words.length > 1 ? words[1] : null;
    let candidate = `${buildLocalPart(first, last)}@${pickDomain()}`;
    let suffix = 1;
    while (usedEmails.has(candidate)) {
        candidate = `${buildLocalPart(first, last)}${suffix}@${pickDomain()}`;
        suffix++;
    }
    usedEmails.add(candidate);
    return candidate;
}

function buildEmail(name: string, usedEmails: Set<string>): string {
    const investorMatch = name.match(/^(.+?)\s+Investor\s+(\d+)$/i);
    if (investorMatch) {
        const first = INVESTOR_FIRST_NAMES[Math.floor(Math.random() * INVESTOR_FIRST_NAMES.length)];
        const last = INVESTOR_LAST_NAMES[Math.floor(Math.random() * INVESTOR_LAST_NAMES.length)];
        return buildEmailFromWords([first.toLowerCase(), last.toLowerCase()], usedEmails);
    }
    return buildEmailFromWords(slugifyName(name), usedEmails);
}

interface ChangeEntry { field: string; prior: any; new: any; }
interface Row { table: 'buyer' | 'seller'; id: string; name: string; changes: ChangeEntry[]; }

export async function backfillRealisticContactsV2(
    prisma: PrismaClient,
    apply: boolean
): Promise<{ updated: number; rows: Row[] }> {
    const buyers = await prisma.buyer.findMany({ select: { id: true, name: true, email: true } });
    const sellers = await prisma.seller.findMany({ select: { id: true, name: true, email: true } });

    const usedBuyerEmails = new Set(buyers.map((b) => b.email));
    const usedSellerEmails = new Set(sellers.map((s) => s.email));

    const rows: Row[] = [];

    for (const buyer of buyers) {
        if (EXCLUDED_EMAILS.has(buyer.email)) continue;
        const newEmail = buildEmail(buyer.name, usedBuyerEmails);
        rows.push({ table: 'buyer', id: buyer.id, name: buyer.name, changes: [{ field: 'email', prior: buyer.email, new: newEmail }] });
    }

    for (const seller of sellers) {
        if (EXCLUDED_EMAILS.has(seller.email)) continue;
        const newEmail = buildEmail(seller.name, usedSellerEmails);
        rows.push({ table: 'seller', id: seller.id, name: seller.name, changes: [{ field: 'email', prior: seller.email, new: newEmail }] });
    }

    if (apply) {
        for (const row of rows) {
            const data = { email: row.changes[0].new };
            if (row.table === 'buyer') await prisma.buyer.update({ where: { id: row.id }, data });
            else await prisma.seller.update({ where: { id: row.id }, data });
        }
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(
        logDir,
        `realistic-contacts-v2-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(logPath, JSON.stringify({ apply, updated: rows.length, rows }, null, 2));

    console.log(`[backfill-realistic-contacts-v2] ${apply ? 'APPLIED' : 'DRY RUN'} - changed: ${rows.length}`);
    console.log(`[backfill-realistic-contacts-v2] Audit log written to ${logPath}`);

    return { updated: rows.length, rows };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    const prisma = new PrismaClient();
    backfillRealisticContactsV2(prisma, apply)
        .then((result) => {
            for (const row of result.rows) {
                console.log(`[${row.table}] ${row.id.slice(0, 8)} | ${row.name.padEnd(35)} | email: ${row.changes[0].prior} -> ${row.changes[0].new}`);
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
