import { useCallback, useEffect, useState } from 'react';
import { analyticsApi } from '../api/analytics';
import {
  AnalyticsEnvelope,
  AnalyticsFilters,
  SellerBudgetFitData,
  SellerListingsData,
  SellerMatchTrendData,
  SellerSummaryData,
} from '../types/analytics';

interface SellerAnalyticsState {
  summary: AnalyticsEnvelope<SellerSummaryData> | null;
  listings: AnalyticsEnvelope<SellerListingsData> | null;
  budgetFit: AnalyticsEnvelope<SellerBudgetFitData> | null;
  matchTrend: AnalyticsEnvelope<SellerMatchTrendData> | null;
}

export function useSellerAnalytics(filters: AnalyticsFilters) {
  const [data, setData] = useState<SellerAnalyticsState>({
    summary: null,
    listings: null,
    budgetFit: null,
    matchTrend: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [summary, listings, budgetFit, matchTrend] = await Promise.all([
        analyticsApi.getSellerSummary(filters),
        analyticsApi.getSellerListings(filters),
        analyticsApi.getSellerBudgetFit(filters),
        analyticsApi.getSellerMatchTrend(filters),
      ]);

      setData({ summary, listings, budgetFit, matchTrend });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load seller analytics');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load };
}
