import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '../api/analytics';
import {
  AdminDemandSupplyData,
  AdminMarketDistributionData,
  AdminMatchQualityData,
  AdminOverviewData,
  AdminPipelineData,
  AdminSellerDetailData,
  AnalyticsEnvelope,
  AnalyticsFilters,
} from '../types/analytics';

interface AdminAnalyticsState {
  overview: AnalyticsEnvelope<AdminOverviewData> | null;
  pipeline: AnalyticsEnvelope<AdminPipelineData> | null;
  matchQuality: AnalyticsEnvelope<AdminMatchQualityData> | null;
  marketDistribution: AnalyticsEnvelope<AdminMarketDistributionData> | null;
  demandSupply: AnalyticsEnvelope<AdminDemandSupplyData> | null;
  sellerDetail: AnalyticsEnvelope<AdminSellerDetailData> | null;
}

export function useAdminAnalytics(filters: AnalyticsFilters, selectedSellerId?: string) {
  const [data, setData] = useState<AdminAnalyticsState>({
    overview: null,
    pipeline: null,
    matchQuality: null,
    marketDistribution: null,
    demandSupply: null,
    sellerDetail: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [overview, pipeline, matchQuality, marketDistribution, demandSupply] = await Promise.all([
        analyticsApi.getAdminOverview(filters),
        analyticsApi.getAdminPipeline(filters),
        analyticsApi.getAdminMatchQuality(filters),
        analyticsApi.getAdminMarketDistribution(filters),
        analyticsApi.getAdminDemandSupply(filters),
      ]);

      const sellerDetail = selectedSellerId
        ? await analyticsApi.getAdminSellerDetail(selectedSellerId, filters)
        : null;

      setData({
        overview,
        pipeline,
        matchQuality,
        marketDistribution,
        demandSupply,
        sellerDetail,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin analytics');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedSellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
