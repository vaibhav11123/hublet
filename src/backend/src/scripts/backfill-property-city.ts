/**
 * backfill-property-city.ts
 *
 * One-time repair for Issue 4: metadata.city was never set on any property
 * (createProperty didn't set it until property.service.ts was fixed). This
 * backfills metadata.city for every existing property using the same
 * deriveCityFromLocality logic now used at creation time, so
 * analytics.service.ts's getCityForProperty stops falling back to
 * seller.metadata.city (or 'unknown') for pre-existing rows.
 *
 * Safety: defaults to dry-run (prints the proposed change and writes an
 * audit log of every property's prior state, but does not write to the DB).
 * Pass --apply to actually perform the update. Every property that would
 * still be unresolved after all fallback tiers is logged and left untouched
 * rather than guessed.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-property-city.ts            # dry run
 *   npx tsx src/scripts/backfill-property-city.ts --apply     # real backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { deriveCityFromLocality } from '../utils/locality-city';

function safeParseJson(value: string | null | undefined, fallback: any = null) {
    if (!value) return fallback;
    try {
        return JSON.parse(value) ?? fallback;
    } catch {
        return fallback;
    }
}

export async function backfillPropertyCity(prisma: PrismaClient, apply: boolean): Promise<{
    updated: number;
    alreadySet: number;
    unresolved: number;
    rows: Array<{ id: string; title: string; locality: string; priorMetadata: any; derivedCity: string | null; rule: string }>;
}> {
    const properties = await prisma.property.findMany({ include: { seller: true } });

    const rows: Array<{ id: string; title: string; locality: string; priorMetadata: any; derivedCity: string | null; rule: string }> = [];
    let updated = 0;
    let alreadySet = 0;
    let unresolved = 0;

    for (const property of properties) {
        const metadata = safeParseJson(property.metadata, {});

        if (metadata.city) {
            alreadySet++;
            continue;
        }

        const sellerMeta = safeParseJson(property.seller?.metadata, null);
        const result = deriveCityFromLocality(property.locality, metadata.sourceUrl, sellerMeta?.city);

        rows.push({
            id: property.id,
            title: property.title,
            locality: property.locality,
            priorMetadata: metadata,
            derivedCity: result.city,
            rule: result.rule,
        });

        if (!result.city) {
            unresolved++;
            continue;
        }

        if (apply) {
            const newMetadata = { ...metadata, city: result.city };
            await prisma.property.update({
                where: { id: property.id },
                data: { metadata: JSON.stringify(newMetadata) },
            });
        }
        updated++;
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `property-city-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logPath, JSON.stringify({ apply, updated, alreadySet, unresolved, rows }, null, 2));

    console.log(`[backfill-property-city] ${apply ? 'APPLIED' : 'DRY RUN'} - updated: ${updated}, already set: ${alreadySet}, unresolved: ${unresolved}`);
    console.log(`[backfill-property-city] Audit log written to ${logPath}`);

    return { updated, alreadySet, unresolved, rows };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    const prisma = new PrismaClient();
    backfillPropertyCity(prisma, apply)
        .then((result) => {
            for (const row of result.rows) {
                console.log(`${row.id.slice(0, 8)} | ${row.rule.padEnd(18)} | "${row.locality}" -> ${row.derivedCity ?? 'UNRESOLVED'}`);
            }
            process.exit(0);
        })
        .catch((err) => {
            console.error('FATAL:', err);
            process.exit(1);
        });
}
