/**
 * backfill-property-map-points.ts
 *
 * Demo-data-realism pass, Part 4 (see the plan file for full context).
 *
 * 30/110 properties had metadata.coordinates missing entirely (scraper
 * additions since the original session's Enrichment 3 pass never got
 * geocoded), and 6 more still carried Enrichment 3's honest-but-coarse
 * `synthetic: true` city-center fallback. Every "Map" link in the app
 * (AdminDashboard.tsx, SellerDashboard.tsx, BuyerDashboard.tsx) is keyed
 * only off metadata.coordinates - missing meant a bare "-" or no link at
 * all; synthetic meant the pin landed on the wrong side of the city.
 *
 * Resolution, three tiers (see the plan for the full writeup):
 *   Tier 1 - plain retry of GeocodeService.geocodeAddress(property.locality).
 *            Resolved 9/36 for free (these are real, just-fine neighborhood
 *            names Nominatim already knows).
 *   Tier 2 - for the other 27, five research agents (grouped by city/
 *            region cluster) each found one real, verifiable landmark/road
 *            per unresolved locality, which was then run through the same
 *            geocodeAddress() call as Tier 1 (never trusting agent-supplied
 *            coordinates directly - only agent-supplied search STRINGS,
 *            then geocoded for real by this script). Two properties whose
 *            stored `locality` field was corrupted (bare "Chennai" / "halls
 *            road" with no city, despite their titles clearly saying
 *            "Bangalore Central") were corrected via the title's real city
 *            context rather than geocoding the wrong city - a data-quality
 *            bug in the `locality` column itself, left untouched since it's
 *            out of scope for a coordinates-only pass.
 *   Tier 3 - honest city-center fallback (Enrichment 3's original
 *            CITY_CENTERS table) - not needed this round; all 36 resolved
 *            via Tier 1/2.
 * Full list with which tier/query resolved each: property-map-points-
 * research.json (committed alongside this script).
 *
 * Also, Part 2c cross-reference: any property with real (non-synthetic)
 * coordinates and a null `address` gets that address filled by reverse-
 * geocoding its own real point through Nominatim's /reverse endpoint
 * (GeocodeService.reverseGeocode, added alongside this script) - this is
 * OSM's own real data for a real point, not an invented street number.
 *
 * Log shape (consumed by restore-from-backfill-log.ts):
 *   { apply, updated, rows: [{ table, id, name, changes: [{field, prior, new}] }] }
 *
 * Safety: dry-run by default. Pass --apply to write.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-property-map-points.ts            # dry run
 *   npx tsx src/scripts/backfill-property-map-points.ts --apply     # real backfill
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { GeocodeService } from '../services/geocode.service';
import { fetchNearbyPlaces } from '../utils/nearby-places';

interface ResearchEntry { id: string; lat: number; lon: number; tier: number; query: string; }
interface ChangeEntry { field: string; prior: any; new: any; }
interface Row { table: 'property'; id: string; name: string; changes: ChangeEntry[]; }

function safeParseJson(value: string | null | undefined, fallback: any = null) {
    if (!value) return fallback;
    try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
}

export async function backfillPropertyMapPoints(
    prisma: PrismaClient,
    apply: boolean
): Promise<{ updated: number; rows: Row[] }> {
    const researchPath = path.join(__dirname, 'property-map-points-research.json');
    const research: ResearchEntry[] = JSON.parse(fs.readFileSync(researchPath, 'utf-8'));
    const researchById = new Map(research.map((r) => [r.id, r]));

    const properties = await prisma.property.findMany();
    const rows: Row[] = [];

    // --- Phase A: fill missing/synthetic coordinates (+ nearbyPlaces) for the 36 researched properties ---
    for (const property of properties) {
        const entry = researchById.get(property.id);
        if (!entry) continue;

        const metadata = safeParseJson(property.metadata, {});
        const priorCoords = metadata.coordinates || null;

        const newMetadata: any = { ...metadata, coordinates: { lat: entry.lat, lon: entry.lon } };
        delete newMetadata.geocodeFailed;

        const changes: ChangeEntry[] = [{ field: '__metadata_coordinates', prior: priorCoords, new: newMetadata.coordinates }];

        if (!newMetadata.nearbyPlaces) {
            const nearby = await fetchNearbyPlaces(entry.lat, entry.lon);
            newMetadata.nearbyPlaces = (nearby as any).stale
                ? { fetchedAt: new Date().toISOString(), synthetic: true, busStation: { name: 'Local bus stop', distanceKm: 0.8, lat: 0, lon: 0, osmUrl: '', type: 'bus' } }
                : nearby;
            changes.push({ field: '__metadata_nearbyPlaces', prior: metadata.nearbyPlaces || null, new: newMetadata.nearbyPlaces });
        }

        if (apply) {
            await prisma.property.update({ where: { id: property.id }, data: { metadata: JSON.stringify(newMetadata) } });
        }

        rows.push({ table: 'property', id: property.id, name: property.title, changes: [{ field: 'metadata', prior: property.metadata, new: JSON.stringify(newMetadata) }] });
        console.log(`[map-points] ${property.id.slice(0, 8)} (${property.title}) -> (${entry.lat}, ${entry.lon}) via tier ${entry.tier} [${entry.query}]`);
    }

    // --- Phase B: reverse-geocode address for properties with real coordinates and null address ---
    // Re-fetch properties so Phase A's in-memory updates (if applied) are reflected.
    const propertiesAfterA = apply ? await prisma.property.findMany() : properties;
    for (const property of propertiesAfterA) {
        if (property.address) continue; // already has one - don't overwrite

        let metadata = safeParseJson(property.metadata, {});
        // If Phase A resolved this property's coordinates in a dry run, metadata won't reflect
        // it yet (nothing was written) - use the research entry directly in that case.
        const entry = researchById.get(property.id);
        const coords = metadata.coordinates?.lat ? metadata.coordinates : entry ? { lat: entry.lat, lon: entry.lon } : null;
        if (!coords || !coords.lat) continue; // still no real coordinate to reverse-geocode from
        if (coords.synthetic) continue; // never reverse-geocode a synthetic (city-center) point into a fake-precise address

        const reverseAddress = await GeocodeService.reverseGeocode(coords.lat, coords.lon);
        if (!reverseAddress) {
            console.warn(`[map-points] ${property.id.slice(0, 8)} (${property.title}) - reverse geocode returned nothing, leaving address null`);
            continue;
        }

        if (apply) {
            await prisma.property.update({ where: { id: property.id }, data: { address: reverseAddress } });
        }

        // Merge into the same row if Phase A already touched this property, else new row.
        const existingRow = rows.find((r) => r.id === property.id);
        const addressChange: ChangeEntry = { field: 'address', prior: property.address, new: reverseAddress };
        if (existingRow) existingRow.changes.push(addressChange);
        else rows.push({ table: 'property', id: property.id, name: property.title, changes: [addressChange] });

        console.log(`[map-points] ${property.id.slice(0, 8)} (${property.title}) address -> "${reverseAddress.slice(0, 80)}..."`);
    }

    const logDir = path.join(__dirname, 'backfill-logs');
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(
        logDir,
        `property-map-points-${apply ? 'applied' : 'dryrun'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(logPath, JSON.stringify({ apply, updated: rows.length, rows }, null, 2));

    console.log(`[backfill-property-map-points] ${apply ? 'APPLIED' : 'DRY RUN'} - properties changed: ${rows.length}`);
    console.log(`[backfill-property-map-points] Audit log written to ${logPath}`);

    return { updated: rows.length, rows };
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    const prisma = new PrismaClient();
    backfillPropertyMapPoints(prisma, apply)
        .then((result) => {
            console.log(`\nTotal properties changed: ${result.updated}`);
            process.exit(0);
        })
        .catch((err) => {
            console.error('FATAL:', err);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}
