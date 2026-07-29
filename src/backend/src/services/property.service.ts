import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';
import { forwardGeocode } from '../utils/geocoder';
import { fetchNearbyPlaces } from '../utils/nearby-places';
import { GeocodeService } from './geocode.service';

export class PropertyService {
    /**
     * Create a new property.
     * Auto-geocodes locality if no coordinates provided.
     * Auto-triggers matching for all compatible buyers.
     */
    static async createProperty(data: {
        sellerId: string;
        title: string;
        description?: string;
        locality: string;
        address?: string;
        area: number;
        bhk: number;
        price: number;
        amenities?: string[];
        propertyType?: string;
        contact?: string;
        metadata?: any;
    }) {
        // Merge any incoming metadata with geocoded coordinates
        let mergedMetadata: any = data.metadata || {};

        // If coordinates are already provided (from map picker), use them.
        // Otherwise, try to geocode the locality (non-blocking).
        if (!mergedMetadata.coordinates && !mergedMetadata.geocodeFailed) {
            try {
                const geoQuery = data.address || data.locality;
                const coords = await GeocodeService.geocodeAddress(geoQuery);
                if (coords) {
                    mergedMetadata.coordinates = { lat: coords.lat, lon: coords.lon };
                    console.log(`[PropertyService] Geocoded "${geoQuery}" → ${coords.lat}, ${coords.lon}`);
                } else {
                    mergedMetadata.geocodeFailed = true;
                }
            } catch (err) {
                console.error('[PropertyService] Geocoding failed (non-blocking):', err);
                mergedMetadata.geocodeFailed = true;
            }
        }

        // After we have coordinates, fetch nearby POIs via Overpass API (non-blocking).
        if (mergedMetadata.coordinates && !mergedMetadata.nearbyPlaces) {
            try {
                const { lat, lon } = mergedMetadata.coordinates;
                mergedMetadata.nearbyPlaces = await fetchNearbyPlaces(lat, lon);
                console.log(
                    `[PropertyService] Nearby POIs fetched for (${lat}, ${lon}):`,
                    [
                        mergedMetadata.nearbyPlaces.airport
                            ? `Airport: ${mergedMetadata.nearbyPlaces.airport.name} (${mergedMetadata.nearbyPlaces.airport.distanceKm} km)`
                            : 'No airport found',
                        mergedMetadata.nearbyPlaces.busStation
                            ? `Bus: ${mergedMetadata.nearbyPlaces.busStation.name} (${mergedMetadata.nearbyPlaces.busStation.distanceKm} km)`
                            : 'No bus station found',
                        mergedMetadata.nearbyPlaces.trainStation
                            ? `Train: ${mergedMetadata.nearbyPlaces.trainStation.name} (${mergedMetadata.nearbyPlaces.trainStation.distanceKm} km)`
                            : 'No train station found',
                    ].join(' | '),
                );
            } catch (err) {
                console.error('[PropertyService] Nearby places lookup failed (non-blocking):', err);
            }
        }

        const property = await prisma.property.create({
            data: {
                sellerId: data.sellerId,
                title: data.title,
                description: data.description,
                locality: data.locality,
                address: data.address,
                area: data.area,
                bhk: data.bhk,
                price: data.price,
                amenities: JSON.stringify(data.amenities || []),
                propertyType: data.propertyType || 'apartment',
                contact: data.contact || null,
                metadata: Object.keys(mergedMetadata).length > 0 ? JSON.stringify(mergedMetadata) : null,
                isActive: true,
            },
            include: {
                seller: true,
            },
        });

        // Fire-and-forget auto-matching for this new property
        this.triggerAutoMatching(property.id).catch(err =>
            console.error(`[PropertyService] Auto-matching failed for property ${property.id}:`, err.message)
        );

        return property;
    }

    /**
     * Trigger matching for a property against all buyers (async, non-blocking).
     */
    private static async triggerAutoMatching(propertyId: string) {
        // Lazy import to avoid circular dependency
        const { MatchingService } = await import('./matching.service');
        const matchingService = new MatchingService();
        const matches = await matchingService.findMatchesForProperty(propertyId);
        console.log(`[PropertyService] Auto-generated ${matches.length} matches for property ${propertyId}`);
    }

    /**
     * Get property by ID
     */
    static async getPropertyById(id: string) {
        const property = await prisma.property.findUnique({
            where: { id },
            include: {
                seller: true,
                matches: {
                    include: {
                        buyer: true,
                    },
                    orderBy: {
                        matchScore: 'desc',
                    },
                },
            },
        });

        if (!property) return null;

        // Parse JSON strings back to arrays/objects
        return {
            ...property,
            amenities: JSON.parse(property.amenities),
            metadata: property.metadata ? JSON.parse(property.metadata) : null,
        };
    }

    /**
     * Get all properties with filters
     */
    static async getAllProperties(filters?: {
        locality?: string;
        bhk?: number;
        minPrice?: number;
        maxPrice?: number;
        minArea?: number;
        maxArea?: number;
        propertyType?: string;
        isActive?: boolean;
        limit?: number;
    }) {
        const where: any = {
            isActive: filters?.isActive ?? true,
        };

        if (filters?.locality) {
            where.locality = {
                contains: filters.locality,
                mode: 'insensitive',
            };
        }

        if (filters?.bhk) {
            where.bhk = filters.bhk;
        }

        if (filters?.minPrice || filters?.maxPrice) {
            where.price = {
                ...(filters?.minPrice && { gte: filters.minPrice }),
                ...(filters?.maxPrice && { lte: filters.maxPrice }),
            };
        }

        if (filters?.minArea || filters?.maxArea) {
            where.area = {
                ...(filters?.minArea && { gte: filters.minArea }),
                ...(filters?.maxArea && { lte: filters.maxArea }),
            };
        }

        if (filters?.propertyType) {
            where.propertyType = filters.propertyType;
        }

        const properties = await prisma.property.findMany({
            where,
            include: {
                seller: true,
            },
            take: filters?.limit || 100,
            orderBy: { createdAt: 'desc' },
        });

        // Parse JSON strings back to arrays/objects
        return properties.map((property: any) => ({
            ...property,
            amenities: JSON.parse(property.amenities),
            metadata: property.metadata ? JSON.parse(property.metadata) : null,
        }));
    }

    /**
     * Update property
     */
    static async updateProperty(id: string, data: Partial<{
        title: string;
        description: string;
        locality: string;
        address: string;
        area: number;
        bhk: number;
        price: number;
        amenities: string[];
        propertyType: string;
        contact: string;
        isActive: boolean;
        metadata: any;
    }>) {
        // Convert arrays to JSON strings for SQLite
        const updateData: any = { ...data };
        if (data.amenities) {
            updateData.amenities = JSON.stringify(data.amenities);
        }
        if (data.metadata) {
            updateData.metadata = JSON.stringify(data.metadata);
        }

        return await prisma.property.update({
            where: { id },
            data: updateData,
            include: {
                seller: true,
            },
        });
    }

    /**
     * Delete property
     */
    static async deleteProperty(id: string) {
        return await prisma.property.delete({
            where: { id },
        });
    }

    /**
     * Search properties by localities
     */
    static async searchByLocalities(localities: string[], limit = 50) {
        return await prisma.property.findMany({
            where: {
                isActive: true,
                locality: {
                    in: localities,
                },
            },
            include: {
                seller: true,
            },
            take: limit,
        });
    }

    /**
     * Get all properties with coordinates for map display (lightweight).
     */
    static async getPropertiesForMap(filters?: {
        bhk?: number;
        minPrice?: number;
        maxPrice?: number;
        propertyType?: string;
    }) {
        const where: any = { isActive: true };

        if (filters?.bhk) where.bhk = filters.bhk;
        if (filters?.minPrice || filters?.maxPrice) {
            where.price = {
                ...(filters?.minPrice && { gte: filters.minPrice }),
                ...(filters?.maxPrice && { lte: filters.maxPrice }),
            };
        }
        if (filters?.propertyType) where.propertyType = filters.propertyType;

        const properties = await prisma.property.findMany({
            where,
            select: {
                id: true,
                title: true,
                locality: true,
                bhk: true,
                price: true,
                area: true,
                propertyType: true,
                metadata: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        // Filter to only properties with coordinates and return lightweight objects
        return properties
            .map((p: any) => {
                const meta = p.metadata ? JSON.parse(p.metadata) : null;
                if (!meta?.coordinates?.lat || !meta?.coordinates?.lon) return null;
                return {
                    id: p.id,
                    title: p.title,
                    locality: p.locality,
                    bhk: p.bhk,
                    price: p.price,
                    area: p.area,
                    propertyType: p.propertyType,
                    lat: meta.coordinates.lat,
                    lon: meta.coordinates.lon,
                };
            })
            .filter(Boolean);
    }
}
