import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { AnalyticsFilters } from '../types/analytics.types';

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseFilters(req: Request): AnalyticsFilters {
  return {
    from: req.query.from ? String(req.query.from) : undefined,
    to: req.query.to ? String(req.query.to) : undefined,
    city: req.query.city ? String(req.query.city) : undefined,
    locality: req.query.locality ? String(req.query.locality) : undefined,
    bhk: parseNumber(req.query.bhk),
    propertyType: req.query.propertyType ? String(req.query.propertyType) : undefined,
    sellerType: req.query.sellerType ? String(req.query.sellerType) : undefined,
    minScore: parseNumber(req.query.minScore),
    maxScore: parseNumber(req.query.maxScore),
  };
}

function resolveSellerId(req: Request): string | null {
  if (req.user?.role === 'seller' && req.user.userId) {
    return req.user.userId;
  }

  if (req.user?.role === 'admin') {
    const sellerId = req.query.sellerId ? String(req.query.sellerId) : undefined;
    return sellerId || null;
  }

  return null;
}

export class AnalyticsController {
  static async adminOverview(req: Request, res: Response) {
    try {
      const response = await AnalyticsService.getAdminOverview(parseFilters(req));
      return res.status(200).json(response);
    } catch (error: any) {
      return res.status(200).json({
        metadata: {
          generatedAt: new Date().toISOString(),
          filtersApplied: parseFilters(req),
          sampleSize: 0,
        },
        warnings: [error?.message || 'Overview analytics degraded due to partial data'],
        data: {
          totals: { buyers: 0, sellers: 0, properties: 0, leads: 0, matches: 0 },
          avgMatchScore: 0,
          score60PlusRate: 0,
          activeInventoryRate: 0,
          leadConversionByStage: [],
        },
      });
    }
  }

  static async adminPipeline(req: Request, res: Response) {
    try {
      const response = await AnalyticsService.getAdminPipeline(parseFilters(req));
      return res.status(200).json(response);
    } catch (error: any) {
      return res.status(200).json({
        metadata: {
          generatedAt: new Date().toISOString(),
          filtersApplied: parseFilters(req),
          sampleSize: 0,
        },
        warnings: [error?.message || 'Pipeline analytics degraded due to partial data'],
        data: {
          leadConversionByStage: [],
          sellerConversion: [],
          topPerformingLocalitiesBySeller: [],
        },
      });
    }
  }

  static async adminMatchQuality(req: Request, res: Response) {
    try {
      const response = await AnalyticsService.getAdminMatchQuality(parseFilters(req));
      return res.status(200).json(response);
    } catch (error: any) {
      return res.status(200).json({
        metadata: {
          generatedAt: new Date().toISOString(),
          filtersApplied: parseFilters(req),
          sampleSize: 0,
        },
        warnings: [error?.message || 'Match quality analytics degraded due to partial data'],
        data: {
          scoreDistribution: [],
          avgScorePerSeller: [],
          trend: [],
        },
      });
    }
  }

  static async adminMarketDistribution(req: Request, res: Response) {
    try {
      const response = await AnalyticsService.getAdminMarketDistribution(parseFilters(req));
      return res.status(200).json(response);
    } catch (error: any) {
      return res.status(200).json({
        metadata: {
          generatedAt: new Date().toISOString(),
          filtersApplied: parseFilters(req),
          sampleSize: 0,
        },
        warnings: [error?.message || 'Market distribution analytics degraded due to partial data'],
        data: {
          priceDistributionByCityLocality: [],
          pricePerSqftDistribution: [],
          cityToLocalityToListing: [],
        },
      });
    }
  }

  static async adminDemandSupply(req: Request, res: Response) {
    try {
      const response = await AnalyticsService.getAdminDemandSupply(parseFilters(req));
      return res.status(200).json(response);
    } catch (error: any) {
      return res.status(200).json({
        metadata: {
          generatedAt: new Date().toISOString(),
          filtersApplied: parseFilters(req),
          sampleSize: 0,
        },
        warnings: [error?.message || 'Demand supply analytics degraded due to partial data'],
        data: {
          bhkDemandVsSupply: [],
          unmatchedDemandHotspots: [],
          buyerBudgetDistributionByCity: [],
        },
      });
    }
  }

  static async adminSeller(req: Request, res: Response) {
    try {
      const response = await AnalyticsService.getAdminSellerDetail(req.params.sellerId, parseFilters(req));
      return res.status(200).json(response);
    } catch (error: any) {
      return res.status(200).json({
        metadata: {
          generatedAt: new Date().toISOString(),
          filtersApplied: parseFilters(req),
          sampleSize: 0,
        },
        warnings: [error?.message || 'Seller analytics degraded due to partial data'],
        data: {
          seller: {
            sellerId: req.params.sellerId,
            sellerName: 'unknown',
            sellerType: 'unknown',
          },
          performance: {
            avgScore: 0,
            conversionRate: 0,
            avgMatchedBuyerBudget: 0,
            avgMatchedPropertyCost: 0,
          },
          listingBudgetScatter: [],
          topLocalities: [],
          budgetFitByListing: [],
        },
      });
    }
  }

  static async sellerSummary(req: Request, res: Response) {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      return res.status(400).json({ error: 'sellerId is required for admin impersonation view' });
    }

    const response = await AnalyticsService.getSellerSummary(sellerId, parseFilters(req));
    return res.status(200).json(response);
  }

  static async sellerListings(req: Request, res: Response) {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      return res.status(400).json({ error: 'sellerId is required for admin impersonation view' });
    }

    const response = await AnalyticsService.getSellerListings(sellerId, parseFilters(req));
    return res.status(200).json(response);
  }

  static async sellerBudgetFit(req: Request, res: Response) {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      return res.status(400).json({ error: 'sellerId is required for admin impersonation view' });
    }

    const response = await AnalyticsService.getSellerBudgetFit(sellerId, parseFilters(req));
    return res.status(200).json(response);
  }

  static async sellerMatchTrend(req: Request, res: Response) {
    const sellerId = resolveSellerId(req);
    if (!sellerId) {
      return res.status(400).json({ error: 'sellerId is required for admin impersonation view' });
    }

    const response = await AnalyticsService.getSellerMatchTrend(sellerId, parseFilters(req));
    return res.status(200).json(response);
  }
}
