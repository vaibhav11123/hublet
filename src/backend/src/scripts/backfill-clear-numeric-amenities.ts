/**
 * backfill-clear-numeric-amenities.ts
 *
 * Round 2, Part 3 (see the plan file for full context).
 *
 * 52/110 properties store Property.amenities as raw numeric-ID strings
 * (e.g. ["21","17","2","5","50",...]) instead of names - rendered as
 * literal digit-soup chips in the buyer Matches view and elsewhere,
 * right next to properties showing normal "parking · gym · swimming
 * pool" chips. Root-caused to the upstream Apify actor
 * (stealth_mode/99acres-property-search-scraper) - its own published
 * documentation's example output shows the identical raw-numeric format
 * with no ID-to-name mapping published anywhere. There is no authoritative
 * source to translate the codes correctly; inventing a plausible-looking
 * mapping would be fabrication with zero grounding.
 *
 * Fix: presentation honesty, not invention. Clear `amenities` to `[]` for
 * every property where EVERY entry is purely numeric - the existing
 * `.length > 0` guards already in the frontend (BuyerDashboard.tsx,
 * SellerDashboard.tsx, AdminDashboard.tsx, MatchViewer.tsx) then simply
 * stop rendering that block for these properties, instead of showing
 * garbage. Prior values are fully preserved in the audit log in case a
 * real mapping ever surfaces later.
 *
 * Log shape (consumed by restore-from-backfill-log.ts):
 *   { apply, updated, rows: [{ table, id, name, changes: [{field, prior, new}] }] }
 *
 * Safety: dry-run by default. Pass --apply to write.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-clear-numeric-amenities.ts            # dry run
 *   npx tsx src/scripts/backfill-clear-numeric-amenities.ts --apply     # real backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

function isAllNumeric(amenities: string[]): boolean {
    return amenities.length > 0 && amenities.every((a) => /^\d+$/.test(a));
}

interface ChangeEntry { field: string; prior: any; new: any; }
interface Row { table: 'property'; id: string; name: string; changes: ChangeEntry[]; }

export async function backfillClearNumericAmenities(
    prisma: PrismaClient,
    apply: boolean
): Promise<{ updated: number; rows: Row[] }> {
    const properties = await prisma.property.findMany({ select: { id: true, title: true, amenities: true } });

    const rows: Row[] = [];

    for (const property of properties) {
        let parsed: string[];
        try {
            parsed = JSON.parse(property.amenities || '[]');
        } catch {
            continue;
        }
        if (!Array.isArray(parsed) || !isAllNumeric(parsed)) continue;

        rows.push({
            table: 'property',
            id: property.id,
            name: property.title,
            changes: [{ field: 'amenities', prior: property.amenities, new: JSON.stringify([]) }],
        });
    }

    if (apply) {
        for (const row of rows) {
            await prisma.property.update({ where: { id: row.id }, data: { amenities: row.changes[0].new } });
        }
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(
        logDir,
        `clear-numeric-amenities-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(logPath, JSON.stringify({ apply, updated: rows.length, rows }, null, 2));

    console.log(`[backfill-clear-numeric-amenities] ${apply ? 'APPLIED' : 'DRY RUN'} - changed: ${rows.length}`);
    console.log(`[backfill-clear-numeric-amenities] Audit log written to ${logPath}`);

    return { updated: rows.length, rows };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    const prisma = new PrismaClient();
    backfillClearNumericAmenities(prisma, apply)
        .then((result) => {
            for (const row of result.rows) {
                console.log(`[property] ${row.id.slice(0, 8)} | ${row.name.padEnd(45)} | amenities: ${row.changes[0].prior} -> []`);
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
