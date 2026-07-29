/**
 * seed.routes.ts
 * 
 * Modular admin-only routes for demo seeding operations.
 * Mounted at /api/admin/seed/* — fully self-contained.
 */

import { Router, Request, Response } from 'express';
import { requireRoles } from '../middleware/auth.middleware';
import prisma from '../db/prisma';
import { seedDemoBuyers } from '../scripts/seed-demo-buyers';
import { seedDemoSellers } from '../scripts/seed-demo-sellers';
import { resetSellerTrust } from '../scripts/reset-seller-trust';
import { resetDatabase } from '../scripts/reset-database';
import { getCredentials, logCredential, logCredentials, clearCredentials, removeCredentialByEmail } from '../utils/credential-logger';
import { refreshAllMatches } from '../utils/refresh-matches';

const router = Router();

// ── Seed Demo Buyers ────────────────────────────────────────────────────────
router.post('/demo-buyers', requireRoles('admin'), async (req: Request, res: Response) => {
    try {
        const result = await seedDemoBuyers(prisma);

        // Log seeded buyer credentials
        logCredentials(
            result.buyers.map((b) => ({
                role: 'buyer' as const,
                name: b.name,
                email: b.email,
                password: b.password,
                source: 'seeder' as const,
            }))
        );

        res.json({
            success: true,
            message: `Created ${result.created} demo buyers (${result.skipped} already existed)`,
            created: result.created,
            skipped: result.skipped,
            buyers: result.buyers,
        });

        // Fire-and-forget: refresh matches now that buyers exist
        refreshAllMatches().catch(e => console.error('[seed/demo-buyers] Match refresh error:', e.message));
    } catch (error: any) {
        console.error('[seed/demo-buyers] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Delete All Buyers ───────────────────────────────────────────────────────
router.post('/delete-all-buyers', requireRoles('admin'), async (req: Request, res: Response) => {
    try {
        // Get all buyer emails before deleting (for credential log sync)
        const buyers = await prisma.buyer.findMany({ select: { email: true } });

        await prisma.workflowEvent.deleteMany({});
        await prisma.lead.deleteMany({});
        await prisma.match.deleteMany({});
        await prisma.notification.deleteMany({});
        const deleted = await prisma.buyer.deleteMany({});

        // Remove all buyer credentials from log
        for (const buyer of buyers) {
            if (buyer.email) removeCredentialByEmail(buyer.email);
        }

        res.json({
            success: true,
            message: `Deleted ${deleted.count} buyers (and their leads/matches)`,
            deleted: deleted.count,
        });
    } catch (error: any) {
        console.error('[seed/delete-all-buyers] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Seed Demo Sellers ───────────────────────────────────────────────────────
router.post('/demo-sellers', requireRoles('admin'), async (req: Request, res: Response) => {
    try {
        const result = await seedDemoSellers(prisma);

        // Log seeded seller credentials
        logCredentials(
            result.sellers.map((s) => ({
                role: 'seller' as const,
                name: s.name,
                email: s.email,
                password: s.password,
                source: 'seeder' as const,
            }))
        );

        res.json({
            success: true,
            message: `Created ${result.created} demo sellers (${result.skipped} already existed).`,
            created: result.created,
            skipped: result.skipped,
            sellers: result.sellers,
        });

        // Fire-and-forget: refresh matches now that sellers/properties exist
        refreshAllMatches().catch(e => console.error('[seed/demo-sellers] Match refresh error:', e.message));
    } catch (error: any) {
        console.error('[seed/demo-sellers] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Delete All Sellers ──────────────────────────────────────────────────────
router.post('/delete-all-sellers', requireRoles('admin'), async (req: Request, res: Response) => {
    try {
        // Get all seller emails before deleting (for credential log sync)
        const sellers = await prisma.seller.findMany({ select: { email: true } });

        // Delete dependents first: leads → matches → properties → sellers
        await prisma.workflowEvent.deleteMany({});
        await prisma.lead.deleteMany({});
        await prisma.match.deleteMany({});
        await prisma.notification.deleteMany({});
        await prisma.property.deleteMany({});
        const deleted = await prisma.seller.deleteMany({});

        // Remove all seller credentials from log
        for (const seller of sellers) {
            if (seller.email) removeCredentialByEmail(seller.email);
        }

        res.json({
            success: true,
            message: `Deleted ${deleted.count} sellers (and their properties/leads/matches)`,
            deleted: deleted.count,
        });
    } catch (error: any) {
        console.error('[seed/delete-all-sellers] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Reset Seller Trust ──────────────────────────────────────────────────────
router.post('/reset-seller-trust', requireRoles('admin'), async (req: Request, res: Response) => {
    try {
        const result = await resetSellerTrust(prisma);
        res.json({
            success: true,
            message: `Reset trust scores for ${result.updated} sellers`,
            updated: result.updated,
            sellers: result.sellers,
        });
    } catch (error: any) {
        console.error('[seed/reset-seller-trust] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Reset Entire Database ───────────────────────────────────────────────────
router.post('/reset-database', requireRoles('admin'), async (req: Request, res: Response) => {
    try {
        const reseed = req.query.reseed !== 'false';
        const result = await resetDatabase(prisma, { reseed });

        // Log admin credentials as well
        logCredential({
            role: 'admin',
            name: 'Admin',
            email: process.env.ADMIN_EMAIL || 'hublet@iiit.ac.in',
            password: process.env.ADMIN_PASSWORD || 'admin123',
            source: 'env',
        });

        res.json({
            success: true,
            message: 'Database reset complete',
            ...result,
        });
    } catch (error: any) {
        console.error('[seed/reset-database] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── View Credentials ────────────────────────────────────────────────────────
router.get('/credentials', requireRoles('admin'), async (_req: Request, res: Response) => {
    try {
        const credentials = getCredentials();
        res.json({ success: true, count: credentials.length, credentials });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ── Seed All (buyers + sellers in one call) ─────────────────────────────────
router.post('/seed-all', requireRoles('admin'), async (req: Request, res: Response) => {
    try {
        const buyerResult = await seedDemoBuyers(prisma);
        logCredentials(
            buyerResult.buyers.map((b) => ({
                role: 'buyer' as const, name: b.name, email: b.email, password: b.password, source: 'seeder' as const,
            }))
        );

        const sellerResult = await seedDemoSellers(prisma);
        logCredentials(
            sellerResult.sellers.map((s) => ({
                role: 'seller' as const, name: s.name, email: s.email, password: s.password, source: 'seeder' as const,
            }))
        );

        res.json({
            success: true,
            message: `Seeded ${buyerResult.created} buyers + ${sellerResult.created} sellers`,
            buyers: { created: buyerResult.created, skipped: buyerResult.skipped },
            sellers: { created: sellerResult.created, skipped: sellerResult.skipped },
        });

        // Fire-and-forget: refresh matches now that all data is seeded
        refreshAllMatches().catch(e => console.error('[seed/seed-all] Match refresh error:', e.message));
    } catch (error: any) {
        console.error('[seed/seed-all] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
