/**
 * restore-from-backfill-log.ts
 *
 * Generic "undo" for any of the four backfill scripts in this demo-data-
 * realism pass (backfill-realistic-contacts.ts, backfill-seller-ratings.ts,
 * backfill-property-descriptions.ts, backfill-property-map-points.ts). Each
 * of those writes its `-applied-<timestamp>.json` log in one canonical
 * shape:
 *
 *   { apply: true, updated: number, rows: [
 *       { table: 'buyer'|'seller'|'property', id: string, name: string,
 *         changes: [{ field: string, prior: any, new: any }, ...] },
 *       ...
 *   ]}
 *
 * This script reads that log and writes every `prior` value back via a
 * direct prisma update - the data-level equivalent of `git revert` for a
 * backfill's code. It does NOT touch git history; run it alongside a
 * `git revert <sha>` of the commit that shipped the log, not instead of it.
 *
 * Safety: dry-run by default (prints what it would restore, writes nothing).
 * Pass --apply to actually write. Also writes its own audit log (of what it
 * restored, i.e. the *pre-restore* - which is the backfilled - values) so a
 * restore is itself inspectable after the fact.
 *
 * Usage:
 *   npx tsx src/scripts/restore-from-backfill-log.ts <path-to-applied-log.json>            # dry run
 *   npx tsx src/scripts/restore-from-backfill-log.ts <path-to-applied-log.json> --apply      # real restore
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface ChangeEntry {
    field: string;
    prior: any;
    new: any;
}

interface CanonicalRow {
    table: 'buyer' | 'seller' | 'property';
    id: string;
    name: string;
    changes: ChangeEntry[];
}

interface CanonicalLog {
    apply: boolean;
    updated: number;
    rows: CanonicalRow[];
}

function getModel(prisma: PrismaClient, table: string) {
    switch (table) {
        case 'buyer': return prisma.buyer;
        case 'seller': return prisma.seller;
        case 'property': return prisma.property;
        default: throw new Error(`Unknown table "${table}" in log - expected buyer/seller/property`);
    }
}

export async function restoreFromBackfillLog(
    prisma: PrismaClient,
    logPath: string,
    apply: boolean
): Promise<{ restored: number; skipped: number }> {
    const raw = fs.readFileSync(logPath, 'utf-8');
    const log: CanonicalLog = JSON.parse(raw);

    if (!log.apply) {
        throw new Error(`"${logPath}" is a dry-run log (apply:false) - nothing was ever written to the DB, so there's nothing to restore. Pass the corresponding -applied- log instead.`);
    }
    if (!Array.isArray(log.rows) || log.rows.length === 0) {
        throw new Error(`"${logPath}" has no rows - nothing to restore.`);
    }

    let restored = 0;
    let skipped = 0;
    const restoreAudit: Array<{ table: string; id: string; name: string; changes: ChangeEntry[] }> = [];

    for (const row of log.rows) {
        if (!row.table || !row.id || !Array.isArray(row.changes)) {
            console.warn(`[restore] Skipping malformed row: ${JSON.stringify(row).slice(0, 100)}`);
            skipped++;
            continue;
        }

        const model = getModel(prisma, row.table);
        const data: Record<string, any> = {};
        for (const change of row.changes) data[change.field] = change.prior;

        console.log(
            `[restore] ${row.table} ${row.id.slice(0, 8)} (${row.name}): ` +
                row.changes.map((c) => `${c.field}: ${JSON.stringify(c.new)} -> ${JSON.stringify(c.prior)}`).join(', ')
        );

        if (apply) {
            // @ts-expect-error - dynamically dispatched model, shape varies by table
            await model.update({ where: { id: row.id }, data });
        }

        restoreAudit.push({ table: row.table, id: row.id, name: row.name, changes: row.changes });
        restored++;
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const sourceName = path.basename(logPath).replace(/\.json$/, '');
    const outPath = path.join(
        logDir,
        `restore-of-${sourceName}-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(outPath, JSON.stringify({ apply, sourceLog: logPath, restored, skipped, rows: restoreAudit }, null, 2));

    console.log(`[restore] ${apply ? 'APPLIED' : 'DRY RUN'} - restored: ${restored}, skipped: ${skipped}`);
    console.log(`[restore] Audit log written to ${outPath}`);

    return { restored, skipped };
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const logPathArg = args.find((a) => !a.startsWith('--'));

    if (!logPathArg) {
        console.error('Usage: npx tsx src/scripts/restore-from-backfill-log.ts <path-to-applied-log.json> [--apply]');
        process.exit(1);
    }

    const resolvedPath = path.isAbsolute(logPathArg) ? logPathArg : path.join(process.cwd(), logPathArg);
    const prisma = new PrismaClient();

    restoreFromBackfillLog(prisma, resolvedPath, apply)
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('FATAL:', err.message || err);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}
