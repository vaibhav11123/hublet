import prisma from '../db/prisma';
import { RuleBasedMatcher, Matcher, BuyerIntent, PropertyData } from '../matchers/rule-based-matcher';
import { WorkflowEventService } from './workflow-event.service';
import { KeywordIntentParser } from '../parsers/intent-parser';
import { GeocodeService } from './geocode.service';
import { NotificationService } from './notification.service';
import { getLocalityIntel } from './locality-intel.service';

function safeParseJson(value: any, defaultValue: any = null) {
    if (value === null || value === undefined || value === '' || value === 'null') return defaultValue;
    if (typeof value === 'object') return value || defaultValue; // Handle array/object directly (null is object, so it will fall back)
    try {
        const parsed = JSON.parse(value);
        return parsed === null ? defaultValue : parsed;
    } catch (e) {
        return defaultValue;
    }
}

const intentParser = new KeywordIntentParser();

export class MatchingService {
    private matcher: Matcher;

    constructor(matcher?: Matcher) {
        // Use rule-based matcher by default, but allow injection of different matchers
        this.matcher = matcher || new RuleBasedMatcher();
    }

    /**
     * Find matches for a buyer
     */
    async findMatchesForBuyer(buyerId: string, options?: {
        minScore?: number;
        limit?: number;
    }) {
        const minScore = options?.minScore || 40; // Default minimum score
        const limit = options?.limit || 50;

        // Get buyer with intent
        const buyer = await prisma.buyer.findUnique({
            where: { id: buyerId },
        });

        if (!buyer) {
            throw new Error(`Buyer ${buyerId} not found`);
        }

        // Get all active properties
        const properties = await prisma.property.findMany({
            where: { isActive: true },
            include: { seller: true },
        });

        // Pre-process buyer coordinates
        const buyerMeta = safeParseJson(buyer.metadata, {});
        if (!buyerMeta.localityCoords || buyerMeta.localityCoords.length === 0) {
            console.warn(`Buyer ${buyerId} has no locality coords in metadata — location scoring will be 0`);
        }

        // Pre-process properties
        for (const property of properties) {
            const propMeta = safeParseJson(property.metadata, {});
            let metaChanged = false;

            if (!propMeta.coordinates && !propMeta.geocodeFailed) {
                console.log(`Geocoding property locality: ${property.locality}`);
                const coords = await GeocodeService.geocodeAddress(property.locality);
                if (coords) {
                    propMeta.coordinates = coords;
                } else {
                    propMeta.geocodeFailed = true;
                }
                metaChanged = true;
            }

            if (!propMeta.marketIntel && !propMeta.marketIntelFailed) {
                console.log(`Fetching locality intel for: ${property.locality}`);
                const intel = await getLocalityIntel(property.locality);
                if (intel) {
                    propMeta.marketIntel = intel;
                } else {
                    propMeta.marketIntelFailed = true;
                }
                metaChanged = true;
            }

            if (metaChanged) {
                await prisma.property.update({
                    where: { id: property.id },
                    data: { metadata: JSON.stringify(propMeta) }
                });
                property.metadata = JSON.stringify(propMeta);
            }
        }

        const matches = properties
            .map(property => {
                // Parse JSON strings for SQLite
                const buyerMeta = safeParseJson(buyer.metadata, null);
                const propMeta = safeParseJson(property.metadata, null);

                const buyerIntent: BuyerIntent = {
                    localityCoords: buyerMeta?.localityCoords || undefined,
                    areaMin: buyer.areaMin || undefined,
                    areaMax: buyer.areaMax || undefined,
                    bhk: buyer.bhk || undefined,
                    budgetMin: buyer.budgetMin || undefined,
                    budgetMax: buyer.budgetMax || undefined,
                    amenities: buyer.amenities && buyer.amenities !== 'null' ? safeParseJson(buyer.amenities) : [],
                };

                const propertyData: PropertyData = {
                    locality: property.locality,
                    lat: propMeta?.coordinates?.lat,
                    lon: propMeta?.coordinates?.lon,
                    area: property.area,
                    bhk: property.bhk,
                    price: property.price,
                    amenities: property.amenities && property.amenities !== 'null' ? safeParseJson(property.amenities) : [],
                };

                const matchResult = this.matcher.score(buyerIntent, propertyData);

                return {
                    property,
                    matchResult,
                };
            })
            .filter(match => match.matchResult.totalScore >= minScore)
            .sort((a, b) => b.matchResult.totalScore - a.matchResult.totalScore)
            .slice(0, limit);

        let newMatchesCount = 0;
        
        // Store matches in database
        const storedMatches = await Promise.all(
            matches.map(async match => {
                // Check if match already exists
                const existing = await prisma.match.findUnique({
                    where: {
                        buyerId_propertyId: {
                            buyerId,
                            propertyId: match.property.id,
                        },
                    },
                });

                if (existing) {
                    // Update existing match
                    const updated = await prisma.match.update({
                        where: { id: existing.id },
                        data: {
                            matchScore: match.matchResult.totalScore,
                            locationScore: match.matchResult.locationScore,
                            budgetScore: match.matchResult.budgetScore,
                            sizeScore: match.matchResult.sizeScore,
                            amenitiesScore: match.matchResult.amenitiesScore,
                        },
                        include: {
                            property: {
                                include: { seller: true },
                            },
                        },
                    });

                    return {
                        ...updated,
                        property: updated.property ? {
                            ...updated.property,
                            amenities: updated.property.amenities && updated.property.amenities !== 'null' ? safeParseJson(updated.property.amenities) : [],
                            metadata: updated.property.metadata ? safeParseJson(updated.property.metadata) : null,
                        } : null,
                        metadata: updated.metadata && updated.metadata !== 'null' ? safeParseJson(updated.metadata) : null,
                    };
                }

                // Create new match
                newMatchesCount++;
                const created = await prisma.match.create({
                    data: {
                        buyerId,
                        propertyId: match.property.id,
                        matchScore: match.matchResult.totalScore,
                        locationScore: match.matchResult.locationScore,
                        budgetScore: match.matchResult.budgetScore,
                        sizeScore: match.matchResult.sizeScore,
                        amenitiesScore: match.matchResult.amenitiesScore,
                    },
                    include: {
                        property: {
                            include: { seller: true },
                        },
                    },
                });

                return {
                    ...created,
                    property: created.property ? {
                        ...created.property,
                        amenities: created.property.amenities && created.property.amenities !== 'null' ? safeParseJson(created.property.amenities) : [],
                        metadata: created.property.metadata ? safeParseJson(created.property.metadata) : null,
                    } : null,
                    metadata: created.metadata && created.metadata !== 'null' ? safeParseJson(created.metadata) : null,
                };
            })
        );

        // Log match generation event
        await WorkflowEventService.logEvent({
            eventType: 'MATCH_GENERATED',
            description: `Generated ${storedMatches.length} matches for buyer ${buyerId}`,
            metadata: {
                buyerId,
                matchCount: storedMatches.length,
                minScore,
            },
        });

        // Trigger Notifications for the buyer if there are brand new matches discovered
        if (newMatchesCount > 0) {
            await NotificationService.notifyBuyerOfMatches(buyerId, newMatchesCount);
        }

        return storedMatches;
    }

    /**
     * Find matches for a property (which buyers might be interested)
     */
    async findMatchesForProperty(propertyId: string, options?: {
        minScore?: number;
        limit?: number;
    }) {
        const minScore = options?.minScore || 40;
        const limit = options?.limit || 50;

        // Get property
        const property = await prisma.property.findUnique({
            where: { id: propertyId },
            include: { seller: true },
        });

        if (!property) {
            throw new Error(`Property ${propertyId} not found`);
        }

        const propMeta = property.metadata ? safeParseJson(property.metadata) : {};
        if (!propMeta.coordinates && !propMeta.geocodeFailed) {
            console.log(`Geocoding property locality: ${property.locality}`);
            const coords = await GeocodeService.geocodeAddress(property.locality);
            if (coords) {
                propMeta.coordinates = coords;
            } else {
                propMeta.geocodeFailed = true;
            }

            await prisma.property.update({
                where: { id: property.id },
                data: { metadata: JSON.stringify(propMeta) }
            });
            property.metadata = JSON.stringify(propMeta);
        }

        // Get all buyers
        const buyers = await prisma.buyer.findMany();

        // Pre-process buyers sequentially
        for (const buyer of buyers) {
            const buyerMeta = safeParseJson(buyer.metadata, {});
            if (!buyerMeta.localityCoords || buyerMeta.localityCoords.length === 0) {
                console.warn(`Buyer ${buyer.id} has no locality coords — skipping geocode`);
            }
        }

        // Score each buyer
        const matches = buyers
            .map(buyer => {
                const buyerMeta = safeParseJson(buyer.metadata, null);
                const propMeta = safeParseJson(property.metadata, null);

                const buyerIntent: BuyerIntent = {
                    localityCoords: buyerMeta?.localityCoords || undefined,
                    areaMin: buyer.areaMin || undefined,
                    areaMax: buyer.areaMax || undefined,
                    bhk: buyer.bhk || undefined,
                    budgetMin: buyer.budgetMin || undefined,
                    budgetMax: buyer.budgetMax || undefined,
                    amenities: buyer.amenities && buyer.amenities !== 'null' ? safeParseJson(buyer.amenities) : [],
                };

                const propertyData: PropertyData = {
                    locality: property.locality,
                    lat: propMeta?.coordinates?.lat,
                    lon: propMeta?.coordinates?.lon,
                    area: property.area,
                    bhk: property.bhk,
                    price: property.price,
                    amenities: property.amenities && property.amenities !== 'null' ? safeParseJson(property.amenities) : [],
                };

                const matchResult = this.matcher.score(buyerIntent, propertyData);

                return {
                    buyer,
                    matchResult,
                };
            })
            .filter(match => match.matchResult.totalScore >= minScore)
            .sort((a, b) => b.matchResult.totalScore - a.matchResult.totalScore)
            .slice(0, limit);

        let newMatchesCount = 0;

        // Store matches in database
        const storedMatches = await Promise.all(
            matches.map(async match => {
                // Check if match already exists
                const existing = await prisma.match.findUnique({
                    where: {
                        buyerId_propertyId: {
                            buyerId: match.buyer.id,
                            propertyId,
                        },
                    },
                });

                if (existing) {
                    return existing;
                }

                newMatchesCount++;
                // Create new match
                return await prisma.match.create({
                    data: {
                        buyerId: match.buyer.id,
                        propertyId,
                        matchScore: match.matchResult.totalScore,
                        locationScore: match.matchResult.locationScore,
                        budgetScore: match.matchResult.budgetScore,
                        sizeScore: match.matchResult.sizeScore,
                        amenitiesScore: match.matchResult.amenitiesScore,
                    },
                    include: {
                        buyer: true,
                    },
                });
            })
        );

        if (newMatchesCount > 0) {
            await NotificationService.notifySellerOfMatches(propertyId, newMatchesCount);
        }

        return storedMatches;
    }

    /**
     * Get all matches for a buyer
     */
    async getMatchesForBuyer(buyerId: string) {
        const matches = await prisma.match.findMany({
            where: { buyerId },
            include: {
                property: {
                    include: { seller: true },
                },
            },
            orderBy: { matchScore: 'desc' },
        });

        // Parse JSON properties for SQLite compatibility
        return matches.map(match => ({
            ...match,
            property: match.property ? {
                ...match.property,
                amenities: match.property.amenities && match.property.amenities !== 'null' ? safeParseJson(match.property.amenities) : [],
                // No metadata parsing needed for frontend unless used? 
                // Let's parse just in case if it's not null
                metadata: match.property.metadata ? safeParseJson(match.property.metadata) : null,
            } : null,
            metadata: match.metadata && match.metadata !== 'null' ? safeParseJson(match.metadata) : null,
        }));
    }

    /**
     * Get all matches for a property
     */
    async getMatchesForProperty(propertyId: string) {
        return await prisma.match.findMany({
            where: { propertyId },
            include: {
                buyer: true,
            },
            orderBy: { matchScore: 'desc' },
        });
    }

    /**
     * Get all matches (Admin)
     */
    async getAllMatches() {
        return await prisma.match.findMany({
            include: {
                buyer: true,
                property: {
                    include: {
                        seller: true,
                    },
                },
            },
            orderBy: { matchScore: 'desc' },
        });
    }
}

