import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';
import { removeCredentialByEmail } from '../utils/credential-logger';
import { GeocodeService } from './geocode.service';

/**
 * Ensures metadata has localityCoords. If missing but localityText exists,
 * attempts geocoding via Nominatim and persists the result.
 */
async function ensureGeocodedMetadata(metadata: Record<string, any> | null | undefined): Promise<Record<string, any>> {
    if (!metadata) metadata = {};
    if (metadata.localityCoords && metadata.localityCoords.length > 0) {
        return metadata; // already has coords
    }

    const text = metadata.localityText || metadata.city;
    if (!text) return metadata; // nothing to geocode

    if (metadata.geocodeFailed) return metadata;

    try {
        const coords = await GeocodeService.geocodeAddress(text);
        if (coords) {
            metadata.localityCoords = [{ name: text, lat: coords.lat, lon: coords.lon }];
            console.log(`[BuyerService] Auto-geocoded "${text}" → ${coords.lat}, ${coords.lon}`);
        } else {
            console.warn(`[BuyerService] Geocoding returned no result for "${text}"`);
            metadata.geocodeFailed = true;
        }
    } catch (e) {
        console.warn(`[BuyerService] Geocoding failed for "${text}":`, e);
        metadata.geocodeFailed = true;
    }
    return metadata;
}

export class BuyerService {
    /**
     * Create a new buyer with intent.
     * Auto-geocodes locality text to coords if localityCoords is missing.
     */
    static async createBuyer(data: {
        name: string;
        email: string;
        phone?: string;
        passwordHash?: string;
        areaMin?: number;
        areaMax?: number;
        bhk?: number;
        budgetMin?: number;
        budgetMax?: number;
        amenities?: string[];
        rawPreferences?: string;
        metadata?: any;
    }) {
        let metadata = data.metadata || {};
        metadata = await ensureGeocodedMetadata(metadata);

        const buyer = await prisma.buyer.create({
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone,
                passwordHash: data.passwordHash,
                areaMin: data.areaMin,
                areaMax: data.areaMax,
                bhk: data.bhk,
                budgetMin: data.budgetMin,
                budgetMax: data.budgetMax,
                amenities: JSON.stringify(data.amenities || []),
                rawPreferences: data.rawPreferences,
                metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
            },
        });

        // Fire-and-forget auto-matching
        BuyerService.triggerAutoMatching(buyer.id).catch(err =>
            console.error(`[BuyerService] Auto-matching failed for buyer ${buyer.id}:`, err.message)
        );

        return buyer;
    }


    /**
     * Get buyer by ID
     */
    static async getBuyerById(id: string) {
        const buyer = await prisma.buyer.findUnique({
            where: { id },
            include: {
                leads: {
                    include: {
                        property: true,
                    },
                },
                matches: {
                    include: {
                        property: {
                            include: {
                                seller: true,
                            },
                        },
                    },
                    orderBy: {
                        matchScore: 'desc',
                    },
                },
            },
        });

        if (!buyer) return null;

        return {
            ...buyer,
            amenities: JSON.parse(buyer.amenities),
            metadata: buyer.metadata ? JSON.parse(buyer.metadata) : null,
        };
    }

    /**
     * Get all buyers
     */
    static async getAllBuyers(filters?: {
        bhk?: number;
        limit?: number;
    }) {
        const where: any = {};

        if (filters?.bhk) {
            where.bhk = filters.bhk;
        }

        const buyers = await prisma.buyer.findMany({
            where,
            take: filters?.limit || 100,
            orderBy: { createdAt: 'desc' },
        });

        let result = buyers.map((buyer: any) => ({
            ...buyer,
            amenities: JSON.parse(buyer.amenities),
            metadata: buyer.metadata ? JSON.parse(buyer.metadata) : null,
        }));

        return result;
    }

    /**
     * Update buyer.
     * Auto-geocodes locality text to coords if localityCoords is missing.
     */
    static async updateBuyer(id: string, data: Partial<{
        name: string;
        email: string;
        phone: string;
        areaMin: number;
        areaMax: number;
        bhk: number;
        budgetMin: number;
        budgetMax: number;
        amenities: string[];
        rawPreferences: string;
        metadata: any;
    }>) {
        const updateData: any = { ...data };
        if (data.amenities) {
            updateData.amenities = JSON.stringify(data.amenities);
        }
        if (data.metadata) {
            const geocoded = await ensureGeocodedMetadata(data.metadata);
            updateData.metadata = JSON.stringify(geocoded);
        }

        const updated = await prisma.buyer.update({
            where: { id },
            data: updateData,
        });

        // Fire-and-forget auto-matching after preference update
        BuyerService.triggerAutoMatching(id).catch(err =>
            console.error(`[BuyerService] Auto-matching failed for buyer ${id}:`, err.message)
        );

        return updated;
    }

    /**
     * Trigger matching for a buyer against all properties (async, non-blocking).
     */
    private static async triggerAutoMatching(buyerId: string) {
        const { MatchingService } = await import('./matching.service');
        const matchingService = new MatchingService();
        const matches = await matchingService.findMatchesForBuyer(buyerId);
        console.log(`[BuyerService] Auto-generated ${matches.length} matches for buyer ${buyerId}`);
    }

    /**
     * Delete buyer
     */
    static async deleteBuyer(id: string) {
        const buyer = await prisma.buyer.findUnique({ where: { id } });
        const result = await prisma.buyer.delete({
            where: { id },
        });
        if (buyer?.email) {
            removeCredentialByEmail(buyer.email);
        }
        return result;
    }
}
