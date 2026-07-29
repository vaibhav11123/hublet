/**
 * refresh-matches.ts
 *
 * Centralized utility to trigger matching for all buyers.
 * Call this after any batch data change (seeding, scraping, fb-save).
 */

import { BuyerService } from '../services/buyer.service';
import { MatchingService } from '../services/matching.service';
import { GeocodeService } from '../services/geocode.service';
import prisma from '../db/prisma';

/**
 * Runs matching for every buyer in the database.
 * First geocodes all un-geocoded properties (once), then matches.
 * Fire-and-forget safe — logs errors internally.
 * Returns { buyersProcessed, totalMatches }.
 */
export async function refreshAllMatches(): Promise<{ buyersProcessed: number; totalMatches: number }> {
    try {
        // ── Phase 1: Geocode all properties that lack coordinates ──
        const allProps = await prisma.property.findMany({ where: { isActive: true } });
        let geocoded = 0;
        for (const prop of allProps) {
            const meta = prop.metadata ? JSON.parse(prop.metadata) : {};
            if (!meta.coordinates && !meta.geocodeFailed) {
                try {
                    const coords = await GeocodeService.geocodeAddress(prop.locality);
                    if (coords) {
                        meta.coordinates = { lat: coords.lat, lon: coords.lon };
                        geocoded++;
                    } else {
                        meta.geocodeFailed = true;
                    }

                    await prisma.property.update({
                        where: { id: prop.id },
                        data: { metadata: JSON.stringify(meta) },
                    });
                } catch (err: any) {
                    console.warn(`[refreshAllMatches] Geocode failed for property ${prop.id}:`, err.message);
                }
            }
        }
        if (geocoded > 0) console.log(`[refreshAllMatches] Geocoded ${geocoded} properties upfront`);

        // ── Phase 2: Run matching for every buyer ──
        const buyers = await BuyerService.getAllBuyers();
        const matchingService = new MatchingService();
        let totalMatches = 0;
        for (const buyer of buyers) {
            try {
                const matches = await matchingService.findMatchesForBuyer(buyer.id);
                totalMatches += matches.length;
            } catch (err: any) {
                console.warn(`[refreshAllMatches] Failed for buyer ${buyer.id}:`, err.message);
            }
        }
        console.log(`[refreshAllMatches] Done: ${buyers.length} buyers, ${totalMatches} matches`);
        return { buyersProcessed: buyers.length, totalMatches };
    } catch (err: any) {
        console.error('[refreshAllMatches] Fatal error:', err.message);
        return { buyersProcessed: 0, totalMatches: 0 };
    }
}

