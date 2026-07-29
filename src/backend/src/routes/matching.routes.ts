import { Router, Request, Response } from 'express';
import { MatchingController } from '../controllers/matching.controller';
import { requireRoles } from '../middleware/auth.middleware';
import { requireBuyerSelfOrAdmin, requirePropertyOwnerOrAdmin } from '../middleware/access.middleware';
import { refreshAllMatches } from '../utils/refresh-matches';

const router = Router();

// Find new matches
router.post('/buyer/:buyerId/find', requireRoles('admin', 'buyer'), requireBuyerSelfOrAdmin('buyerId'), MatchingController.findMatchesForBuyer);
router.post('/property/:propertyId/find', requireRoles('admin', 'seller'), requirePropertyOwnerOrAdmin('propertyId'), MatchingController.findMatchesForProperty);

// Refresh all matches (admin only) — triggers matching for every buyer
router.post('/refresh-all', requireRoles('admin'), async (req: Request, res: Response) => {
    try {
        const result = await refreshAllMatches();
        res.json({ success: true, message: `Refreshed matches for ${result.buyersProcessed} buyers`, ...result });
    } catch (error: any) {
        console.error('[matches/refresh-all] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get existing matches
router.get('/', requireRoles('admin'), MatchingController.getAllMatches);
router.get('/buyer/:buyerId', requireRoles('admin', 'buyer'), requireBuyerSelfOrAdmin('buyerId'), MatchingController.getMatchesForBuyer);
router.get('/property/:propertyId', requireRoles('admin', 'seller'), requirePropertyOwnerOrAdmin('propertyId'), MatchingController.getMatchesForProperty);

export default router;
