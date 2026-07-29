import { Router, Request, Response } from 'express';
import { BuyerController } from '../controllers/buyer.controller';
import { requireRoles } from '../middleware/auth.middleware';
import { requireBuyerSelfOrAdmin } from '../middleware/access.middleware';
import prisma from '../db/prisma';

const router = Router();

router.post('/', requireRoles('admin'), BuyerController.createBuyer);
router.get('/', requireRoles('admin'), BuyerController.getAllBuyers);

// GET /api/buyers/localities-map — returns geocoded buyer localities for admin map
router.get('/localities-map', requireRoles('admin'), async (_req: Request, res: Response) => {
    try {
        const buyers = await prisma.buyer.findMany({
            select: { id: true, name: true, metadata: true },
        });

        // Collect points from metadata.localityCoords only
        const points: Array<{ buyerName: string; locality: string; lat: number; lon: number }> = [];

        for (const b of buyers) {
            let meta: any = {};
            try { 
                const parsed = b.metadata ? JSON.parse(b.metadata) : {}; 
                meta = parsed || {};
            } catch { }

            const coords: Array<{ name: string; lat: number; lon: number }> = meta.localityCoords || [];
            for (const c of coords) {
                if (c.lat && c.lon) {
                    points.push({ buyerName: b.name, locality: c.name, lat: c.lat, lon: c.lon });
                }
            }
        }

        res.json(points);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', requireBuyerSelfOrAdmin('id'), BuyerController.getBuyerById);
router.put('/:id', requireBuyerSelfOrAdmin('id'), BuyerController.updateBuyer);
router.delete('/:id', requireBuyerSelfOrAdmin('id'), BuyerController.deleteBuyer);

export default router;
