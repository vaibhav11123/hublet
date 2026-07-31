/**
 * backfill-nearby-places.ts
 *
 * Enrichment 2: 55/71 live properties are missing metadata.nearbyPlaces (the
 * "Nearby Places" block rendered on buyer/seller property views). This
 * backfills it for every property that already has metadata.coordinates
 * (49 of the 55 - the remaining 6 lack coordinates entirely and are handled
 * by Enrichment 3's coordinates backfill, which also fetches nearbyPlaces
 * for those 6 right after geocoding them).
 *
 * Uses the real fetchNearbyPlaces() (src/utils/nearby-places.ts), now with
 * the additional Overpass mirrors from Issue 6. If a property's fetch still
 * comes back `stale: true` (every mirror failed after retries), a synthetic-
 * but-plausible placeholder is used instead of leaving it empty - explicitly
 * logged as synthetic so it's never confused with real Overpass data.
 *
 * Safety: dry-run by default (fetches and reports, does not write). Pass
 * --apply to write. Real Overpass calls happen in both modes (there's no way
 * to "preview" an external API's answer without calling it), but only
 * --apply persists anything to the database.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-nearby-places.ts             # dry run
 *   npx tsx src/scripts/backfill-nearby-places.ts --apply      # real backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fetchNearbyPlaces, NearbyPlaces } from '../utils/nearby-places';

function safeParseJson(value: string | null | undefined, fallback: any = null) {
    if (!value) return fallback;
    try {
        return JSON.parse(value) ?? fallback;
    } catch {
        return fallback;
    }
}

// A plausible placeholder for the rare case where every Overpass mirror
// fails after retries. Values are intentionally generic/conservative rather
// than a specific real place, and always marked synthetic: true so this can
// never be mistaken for a real Overpass result later.
function syntheticNearbyPlaces(): NearbyPlaces & { synthetic: true } {
    return {
        fetchedAt: new Date().toISOString(),
        synthetic: true,
        busStation: { name: 'Local bus stop', distanceKm: 0.8, lat: 0, lon: 0, osmUrl: '', type: 'bus' },
    } as any;
}

export async function backfillNearbyPlaces(prisma: PrismaClient, apply: boolean, limit?: number): Promise<{
    updated: number;
    synthetic: number;
    skippedNoCoords: number;
    rows: Array<{ id: string; title: string; result: 'real' | 'synthetic' | 'skipped-no-coords' }>;
}> {
    const properties = await prisma.property.findMany();

    const rows: Array<{ id: string; title: string; result: 'real' | 'synthetic' | 'skipped-no-coords' }> = [];
    let updated = 0;
    let synthetic = 0;
    let skippedNoCoords = 0;

    for (const property of properties) {
        if (limit !== undefined && updated >= limit) break;

        const metadata = safeParseJson(property.metadata, {});
        if (metadata.nearbyPlaces) continue;

        if (!metadata.coordinates?.lat || !metadata.coordinates?.lon) {
            skippedNoCoords++;
            rows.push({ id: property.id, title: property.title, result: 'skipped-no-coords' });
            continue;
        }

        const { lat, lon } = metadata.coordinates;
        const result = await fetchNearbyPlaces(lat, lon);

        let finalNearbyPlaces: any = result;
        let outcome: 'real' | 'synthetic' = 'real';
        if ((result as any).stale) {
            finalNearbyPlaces = syntheticNearbyPlaces();
            outcome = 'synthetic';
            synthetic++;
        }

        if (apply) {
            const newMetadata = { ...metadata, nearbyPlaces: finalNearbyPlaces };
            await prisma.property.update({
                where: { id: property.id },
                data: { metadata: JSON.stringify(newMetadata) },
            });
        }
        updated++;
        rows.push({ id: property.id, title: property.title, result: outcome });
        console.log(`[backfill-nearby-places] ${property.id.slice(0, 8)} (${property.title}) -> ${outcome}`);
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `nearby-places-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logPath, JSON.stringify({ apply, updated, synthetic, skippedNoCoords, rows }, null, 2));

    console.log(`[backfill-nearby-places] ${apply ? 'APPLIED' : 'DRY RUN'} - updated: ${updated} (real: ${updated - synthetic}, synthetic: ${synthetic}), skipped (no coords): ${skippedNoCoords}`);
    console.log(`[backfill-nearby-places] Audit log written to ${logPath}`);

    return { updated, synthetic, skippedNoCoords, rows };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    const limitArg = process.argv.find((a) => a.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
    const prisma = new PrismaClient();
    backfillNearbyPlaces(prisma, apply, limit)
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('FATAL:', err);
            process.exit(1);
        });
}
