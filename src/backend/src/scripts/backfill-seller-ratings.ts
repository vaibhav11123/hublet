/**
 * backfill-seller-ratings.ts
 *
 * Demo-data-realism pass, Part 2b (see the plan file for full context).
 *
 * 55/85 sellers have `ratingCount === 0`, rendered as a literal "Not
 * rated" in two places buyers/admins actually look (BuyerDashboard's match
 * view, AdminDashboard's Sellers table). Checked one level deeper: all 55
 * of these sellers also carry an identical flat `rating: 4.00` - invisible
 * today only because the `ratingCount === 0` branch never renders the
 * number.
 *
 * If `ratingCount` alone were fixed without also touching `rating`, the
 * result would be up to 55 sellers simultaneously showing an identical
 * "4.0*" - trading one obvious tell for a worse one. So both fields move
 * together, with one exclusion:
 *
 *   - Sellers where `completedDeals === 0` are left alone. A brand-new
 *     seller with zero closed deals and zero ratings is an *honest* state,
 *     not a fake one - `ratingCount` staying 0 there is correct, not a bug.
 *   - For the rest: `rating` re-rolled uniform in [3.5, 5.0] (the dataset's
 *     own already-observed spread among the ~30 non-flat sellers - not a
 *     new distribution). `ratingCount` set to
 *     max(1, round(completedDeals * (0.25 + random*0.35))), capped at 25
 *     (the top of the range already seen among real-looking sellers) -
 *     loosely tied to completedDeals so a 37-deal agent doesn't end up
 *     with fewer ratings than a 1-deal owner.
 *
 * Pure code, no research agents - see the plan's "where research is/isn't
 * used" section (this is formula-consistent number generation, not a
 * subject that benefits from or needs internet lookup).
 *
 * Log shape (consumed by restore-from-backfill-log.ts):
 *   { apply, updated, rows: [{ table, id, name, changes: [{field, prior, new}] }] }
 *
 * Safety: dry-run by default. Pass --apply to write.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-seller-ratings.ts            # dry run
 *   npx tsx src/scripts/backfill-seller-ratings.ts --apply     # real backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const RATING_COUNT_CAP = 25;

function randomRating(): number {
    return 3.5 + Math.random() * 1.5;
}

function proposedRatingCount(completedDeals: number): number {
    const raw = Math.round(completedDeals * (0.25 + Math.random() * 0.35));
    return Math.min(RATING_COUNT_CAP, Math.max(1, raw));
}

interface ChangeEntry { field: string; prior: any; new: any; }
interface Row { table: 'seller'; id: string; name: string; changes: ChangeEntry[]; }

export async function backfillSellerRatings(
    prisma: PrismaClient,
    apply: boolean
): Promise<{ updated: number; excludedNewSellers: number; rows: Row[] }> {
    const sellers = await prisma.seller.findMany({
        select: { id: true, name: true, rating: true, ratingCount: true, completedDeals: true },
    });

    const rows: Row[] = [];
    let excludedNewSellers = 0;

    for (const seller of sellers) {
        if (seller.ratingCount !== 0) continue; // already has real reviews, nothing to fix

        if (seller.completedDeals === 0) {
            excludedNewSellers++; // honest "brand new, no track record" state - leave as-is
            continue;
        }

        const newRating = randomRating();
        const newRatingCount = proposedRatingCount(seller.completedDeals);

        rows.push({
            table: 'seller',
            id: seller.id,
            name: seller.name,
            changes: [
                { field: 'rating', prior: seller.rating, new: newRating },
                { field: 'ratingCount', prior: seller.ratingCount, new: newRatingCount },
            ],
        });
    }

    if (apply) {
        for (const row of rows) {
            const data: Record<string, any> = {};
            for (const c of row.changes) data[c.field] = c.new;
            await prisma.seller.update({ where: { id: row.id }, data });
        }
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(
        logDir,
        `seller-ratings-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(
        logPath,
        JSON.stringify({ apply, updated: rows.length, excludedNewSellers, rows }, null, 2)
    );

    console.log(`[backfill-seller-ratings] ${apply ? 'APPLIED' : 'DRY RUN'} - changed: ${rows.length}, excluded (completedDeals=0): ${excludedNewSellers}`);
    console.log(`[backfill-seller-ratings] Audit log written to ${logPath}`);

    return { updated: rows.length, excludedNewSellers, rows };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    const prisma = new PrismaClient();
    backfillSellerRatings(prisma, apply)
        .then((result) => {
            for (const row of result.rows) {
                const changeStr = row.changes.map((c) => `${c.field}: ${JSON.stringify(c.prior)} -> ${typeof c.new === 'number' ? c.new.toFixed(2) : c.new}`).join(' | ');
                console.log(`[${row.table}] ${row.id.slice(0, 8)} | ${row.name.padEnd(35)} | ${changeStr}`);
            }
            console.log(`\nTotal changed: ${result.updated}, excluded (completedDeals=0): ${result.excludedNewSellers}`);
            process.exit(0);
        })
        .catch((err) => {
            console.error('FATAL:', err);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}
