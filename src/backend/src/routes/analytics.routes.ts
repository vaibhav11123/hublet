import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { requireRoles } from '../middleware/auth.middleware';

const router = Router();

router.get('/admin/overview', requireRoles('admin'), AnalyticsController.adminOverview);
router.get('/admin/pipeline', requireRoles('admin'), AnalyticsController.adminPipeline);
router.get('/admin/match-quality', requireRoles('admin'), AnalyticsController.adminMatchQuality);
router.get('/admin/market-distribution', requireRoles('admin'), AnalyticsController.adminMarketDistribution);
router.get('/admin/demand-supply', requireRoles('admin'), AnalyticsController.adminDemandSupply);
router.get('/admin/sellers/:sellerId', requireRoles('admin'), AnalyticsController.adminSeller);

router.get('/seller/me/summary', requireRoles('admin', 'seller'), AnalyticsController.sellerSummary);
router.get('/seller/me/listings', requireRoles('admin', 'seller'), AnalyticsController.sellerListings);
router.get('/seller/me/budget-fit', requireRoles('admin', 'seller'), AnalyticsController.sellerBudgetFit);
router.get('/seller/me/match-trend', requireRoles('admin', 'seller'), AnalyticsController.sellerMatchTrend);

export default router;
