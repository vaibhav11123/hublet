/**
 * backfill-seller-trust.ts
 *
 * Enrichment 1: all 49 live sellers currently have completedDeals=0 and
 * trustScore=0, which renders as a red "untrustworthy" badge for every
 * single seller in the admin dashboard's Sellers table
 * (src/frontend/src/components/AdminDashboard.tsx ~385-387). rating is
 * already realistic (3.5-5.0) and is left untouched.
 *
 * completedDeals values below were proposed by a read-only dry-run
 * investigation (varied by sellerType: builders/agents > individual
 * owners, with spread within each type) and reviewed before being
 * committed to backfill-seller-trust-proposed.json. This script applies
 * them via the real SellerService.updateSeller(), which internally calls
 * the actual (private) calculateTrustScore formula - trustScore is never
 * computed or guessed here, only completedDeals is supplied.
 *
 * Safety: defaults to dry-run (prints proposed vs. actual-computed trust
 * score and writes an audit log of every seller's prior state, but does
 * not write to the DB). Pass --apply to actually perform the update.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-seller-trust.ts            # dry run
 *   npx tsx src/scripts/backfill-seller-trust.ts --apply     # real backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { SellerService } from '../services/seller.service';

interface ProposedRow {
    id: string;
    name: string;
    sellerType: string;
    rating: number;
    old_deals: number;
    old_trust: number;
    new_deals: number;
    new_trust: number;
    band: string;
}

export async function backfillSellerTrust(prisma: PrismaClient, apply: boolean): Promise<{
    updated: number;
    skipped: number;
    rows: Array<{ id: string; name: string; priorCompletedDeals: number; priorTrustScore: number; proposedCompletedDeals: number; actualNewTrustScore: number | null }>;
}> {
    const proposedPath = path.join(__dirname, 'backfill-seller-trust-proposed.json');
    const proposed: ProposedRow[] = JSON.parse(fs.readFileSync(proposedPath, 'utf-8'));

    const rows: Array<{ id: string; name: string; priorCompletedDeals: number; priorTrustScore: number; proposedCompletedDeals: number; actualNewTrustScore: number | null }> = [];
    let updated = 0;
    let skipped = 0;

    for (const row of proposed) {
        const seller = await prisma.seller.findUnique({ where: { id: row.id } });
        if (!seller) {
            console.warn(`[backfill-seller-trust] Seller ${row.id} (${row.name}) not found - skipping`);
            skipped++;
            continue;
        }

        if (seller.completedDeals !== 0 || seller.trustScore !== 0) {
            console.warn(`[backfill-seller-trust] Seller ${row.id} (${row.name}) already has non-zero deals/trust - skipping to avoid overwriting real data`);
            skipped++;
            continue;
        }

        let actualNewTrustScore: number | null = null;
        if (apply) {
            const updatedSeller = await SellerService.updateSeller(row.id, { completedDeals: row.new_deals });
            actualNewTrustScore = updatedSeller.trustScore;
        }

        rows.push({
            id: row.id,
            name: row.name,
            priorCompletedDeals: seller.completedDeals,
            priorTrustScore: seller.trustScore,
            proposedCompletedDeals: row.new_deals,
            actualNewTrustScore,
        });
        updated++;
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `seller-trust-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logPath, JSON.stringify({ apply, updated, skipped, rows }, null, 2));

    console.log(`[backfill-seller-trust] ${apply ? 'APPLIED' : 'DRY RUN'} - updated: ${updated}, skipped: ${skipped}`);
    console.log(`[backfill-seller-trust] Audit log written to ${logPath}`);

    return { updated, skipped, rows };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    const prisma = new PrismaClient();
    backfillSellerTrust(prisma, apply)
        .then((result) => {
            for (const row of result.rows) {
                console.log(`${row.id.slice(0, 8)} | ${row.name.padEnd(35)} | deals 0 -> ${row.proposedCompletedDeals} | trust 0 -> ${row.actualNewTrustScore ?? '(dry-run, not computed)'}`);
            }
            process.exit(0);
        })
        .catch((err) => {
            console.error('FATAL:', err);
            process.exit(1);
        });
}
