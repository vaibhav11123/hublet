import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';
import { removeCredentialByEmail } from '../utils/credential-logger';

export class SellerService {
    /**
     * Create a new seller
     */
    static async createSeller(data: {
        name: string;
        email: string;
        phone?: string;
        sellerType?: string;
        rating?: number;
        completedDeals?: number;
        metadata?: any;
    }) {
        const trustScore = this.calculateTrustScore(
            data.rating || 0,
            data.completedDeals || 0
        );

        return await prisma.seller.create({
            data: {
                name: data.name,
                email: data.email,
                phone: data.phone,
                sellerType: data.sellerType || 'owner',
                rating: data.rating || 0,
                completedDeals: data.completedDeals || 0,
                trustScore,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null, // SQLite: store as JSON string
            },
        });
    }

    /**
     * Calculate trust score based on rating and completed deals
     */
    private static calculateTrustScore(rating: number, completedDeals: number): number {
        // Simple formula: weighted average
        // 70% rating (0-5 scale normalized to 0-100)
        // 30% deals (capped at 100, each deal adds 2 points)
        const ratingScore = (rating / 5) * 100 * 0.7;
        const dealsScore = Math.min(completedDeals * 2, 100) * 0.3;
        return Math.round(ratingScore + dealsScore);
    }

    /**
     * Get seller by ID
     */
    static async getSellerById(id: string) {
        const seller = await prisma.seller.findUnique({
            where: { id },
            include: {
                properties: {
                    where: { isActive: true },
                },
            },
        });

        if (!seller) return null;

        // Parse JSON strings back to objects
        return {
            ...seller,
            metadata: seller.metadata ? JSON.parse(seller.metadata) : null,
        };
    }

    /**
     * Get all sellers
     */
    static async getAllSellers(filters?: {
        minTrustScore?: number;
        sellerType?: string;
        limit?: number;
    }) {
        const where: any = {};

        if (filters?.minTrustScore) {
            where.trustScore = {
                gte: filters.minTrustScore,
            };
        }

        if (filters?.sellerType) {
            where.sellerType = filters.sellerType;
        }

        const sellers = await prisma.seller.findMany({
            where,
            include: {
                properties: {
                    select: { id: true, title: true, locality: true, price: true },
                },
                _count: {
                    select: { properties: true },
                },
            },
            take: filters?.limit || 100,
            orderBy: { trustScore: 'desc' },
        });

        // Parse JSON strings back to objects
        return sellers.map((seller: any) => ({
            ...seller,
            metadata: seller.metadata ? JSON.parse(seller.metadata) : null,
            propertyCount: seller._count?.properties || 0,
        }));
    }

    /**
     * Update seller
     */
    static async updateSeller(id: string, data: Partial<{
        name: string;
        email: string;
        phone: string;
        sellerType: string;
        rating: number;
        ratingCount: number;
        completedDeals: number;
        metadata: any;
    }>) {
        // Recalculate trust score if rating or deals changed
        let trustScore: number | undefined;
        if (data.rating !== undefined || data.completedDeals !== undefined) {
            const seller = await prisma.seller.findUnique({ where: { id } });
            if (seller) {
                trustScore = this.calculateTrustScore(
                    data.rating ?? seller.rating,
                    data.completedDeals ?? seller.completedDeals
                );
            }
        }

        // Convert metadata to JSON string for SQLite
        const updateData: any = { ...data };
        if (data.metadata) {
            updateData.metadata = JSON.stringify(data.metadata);
        }

        return await prisma.seller.update({
            where: { id },
            data: {
                ...updateData,
                ...(trustScore !== undefined && { trustScore }),
            },
        });
    }

    /**
     * Delete seller
     */
    static async deleteSeller(id: string) {
        const seller = await prisma.seller.findUnique({ where: { id } });
        if (!seller) {
            throw new Error('Record to delete does not exist.');
        }

        // Clean up all related records before deleting seller
        const properties = await prisma.property.findMany({ where: { sellerId: id } });
        const propertyIds = properties.map(p => p.id);

        if (propertyIds.length > 0) {
            await prisma.workflowEvent.deleteMany({ where: { lead: { propertyId: { in: propertyIds } } } });
            await prisma.lead.deleteMany({ where: { propertyId: { in: propertyIds } } });
            await prisma.match.deleteMany({ where: { propertyId: { in: propertyIds } } });
            await prisma.property.deleteMany({ where: { sellerId: id } });
        }
        await prisma.notification.deleteMany({ where: { sellerId: id } });

        const result = await prisma.seller.delete({
            where: { id },
        });
        if (seller?.email) {
            removeCredentialByEmail(seller.email);
        }
        return result;
    }

    /**
     * Rate seller
     */
    static async rateSeller(id: string, newRating: number) {
        const seller = await prisma.seller.findUnique({ where: { id } });
        if (!seller) throw new Error('Seller not found');

        const currentTotal = seller.rating * seller.ratingCount;
        const newTotalRatings = seller.ratingCount + 1;
        // Compute updated average and round to one decimal place for display
        const rawUpdated = (currentTotal + newRating) / newTotalRatings;
        const updatedRating = Math.round(rawUpdated * 10) / 10;

        const trustScore = this.calculateTrustScore(updatedRating, seller.completedDeals);

        return await prisma.seller.update({
            where: { id },
            data: {
                rating: updatedRating,
                ratingCount: newTotalRatings,
                trustScore,
            },
        });
    }
}
