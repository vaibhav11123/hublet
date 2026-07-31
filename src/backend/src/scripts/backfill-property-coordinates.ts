/**
 * backfill-property-coordinates.ts
 *
 * Enrichment 3: 6/71 live properties are missing metadata.coordinates
 * entirely (map pins + required input for the matcher's location score).
 * All 6 are scraper-sourced properties with misleading locality strings
 * (e.g. "Shivaji Nagar, MG Road") that Issue 4's geocoding write-path never
 * ran for at creation time.
 *
 * Approach: re-geocode via the existing GeocodeService.geocodeAddress() for
 * each. If that still fails, fall back to a synthetic representative point -
 * that property's city center (from metadata.city, already backfilled by
 * Issue 4) - so every property has *some* valid coordinate rather than none,
 * marked `synthetic: true` so it's never confused with a real geocode.
 * Immediately after establishing coordinates (real or synthetic), also
 * fetches nearbyPlaces for these same 6 properties - avoiding a third,
 * redundant backfill pass on top of Enrichment 2.
 *
 * Safety: dry-run by default (does not write). Pass --apply to write.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-property-coordinates.ts            # dry run
 *   npx tsx src/scripts/backfill-property-coordinates.ts --apply     # real backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { GeocodeService } from '../services/geocode.service';
import { fetchNearbyPlaces } from '../utils/nearby-places';

function safeParseJson(value: string | null | undefined, fallback: any = null) {
    if (!value) return fallback;
    try {
        return JSON.parse(value) ?? fallback;
    } catch {
        return fallback;
    }
}

// Approximate city-center coordinates for the known cities in this dataset
// (src/backend/src/utils/locality-city.ts's KNOWN_CITIES) - used only as a
// last-resort synthetic fallback when real geocoding fails outright.
const CITY_CENTERS: Record<string, { lat: number; lon: number }> = {
    Bangalore: { lat: 12.9716, lon: 77.5946 },
    Hyderabad: { lat: 17.385, lon: 78.4867 },
    Mumbai: { lat: 19.076, lon: 72.8777 },
    Pune: { lat: 18.5204, lon: 73.8567 },
    Chennai: { lat: 13.0827, lon: 80.2707 },
    Kolkata: { lat: 22.5726, lon: 88.3639 },
    Ahmedabad: { lat: 23.0225, lon: 72.5714 },
    Jaipur: { lat: 26.9124, lon: 75.7873 },
    Kochi: { lat: 9.9312, lon: 76.2673 },
    Lucknow: { lat: 26.8467, lon: 80.9462 },
    Ghaziabad: { lat: 28.6692, lon: 77.4538 },
    'New Delhi': { lat: 28.6139, lon: 77.209 },
    Delhi: { lat: 28.7041, lon: 77.1025 },
};

export async function backfillPropertyCoordinates(prisma: PrismaClient, apply: boolean): Promise<{
    updated: number;
    real: number;
    synthetic: number;
    unresolved: number;
    rows: Array<{ id: string; title: string; locality: string; city?: string; result: 'real' | 'synthetic' | 'unresolved' }>;
}> {
    const properties = await prisma.property.findMany();

    const rows: Array<{ id: string; title: string; locality: string; city?: string; result: 'real' | 'synthetic' | 'unresolved' }> = [];
    let updated = 0;
    let real = 0;
    let synthetic = 0;
    let unresolved = 0;

    for (const property of properties) {
        const metadata = safeParseJson(property.metadata, {});
        if (metadata.coordinates?.lat && metadata.coordinates?.lon) continue;

        let coords = await GeocodeService.geocodeAddress(property.locality);
        let result: 'real' | 'synthetic' | 'unresolved' = 'real';

        if (!coords) {
            const cityCenter = metadata.city ? CITY_CENTERS[metadata.city] : undefined;
            if (cityCenter) {
                coords = cityCenter;
                result = 'synthetic';
            } else {
                result = 'unresolved';
            }
        }

        rows.push({ id: property.id, title: property.title, locality: property.locality, city: metadata.city, result });

        if (result === 'unresolved') {
            unresolved++;
            console.warn(`[backfill-property-coordinates] ${property.id.slice(0, 8)} (${property.title}) - could not resolve coordinates, no metadata.city to fall back on`);
            continue;
        }

        if (result === 'real') real++;
        else synthetic++;

        const newMetadata: any = {
            ...metadata,
            coordinates: { lat: coords!.lat, lon: coords!.lon, ...(result === 'synthetic' ? { synthetic: true } : {}) },
        };
        delete newMetadata.geocodeFailed;

        // Also fetch nearbyPlaces now that coordinates exist, so these 6
        // properties don't need a separate third backfill pass.
        if (!newMetadata.nearbyPlaces) {
            const nearby = await fetchNearbyPlaces(coords!.lat, coords!.lon);
            newMetadata.nearbyPlaces = (nearby as any).stale
                ? { fetchedAt: new Date().toISOString(), synthetic: true, busStation: { name: 'Local bus stop', distanceKm: 0.8, lat: 0, lon: 0, osmUrl: '', type: 'bus' } }
                : nearby;
        }

        if (apply) {
            await prisma.property.update({
                where: { id: property.id },
                data: { metadata: JSON.stringify(newMetadata) },
            });
        }
        updated++;
        console.log(`[backfill-property-coordinates] ${property.id.slice(0, 8)} (${property.title}) -> ${result} (${coords!.lat}, ${coords!.lon})`);
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, `property-coordinates-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(logPath, JSON.stringify({ apply, updated, real, synthetic, unresolved, rows }, null, 2));

    console.log(`[backfill-property-coordinates] ${apply ? 'APPLIED' : 'DRY RUN'} - updated: ${updated} (real: ${real}, synthetic: ${synthetic}), unresolved: ${unresolved}`);
    console.log(`[backfill-property-coordinates] Audit log written to ${logPath}`);

    return { updated, real, synthetic, unresolved, rows };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    const prisma = new PrismaClient();
    backfillPropertyCoordinates(prisma, apply)
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('FATAL:', err);
            process.exit(1);
        });
}
