import { api } from './client';
import {
  AdminDemandSupplyData,
  AdminMarketDistributionData,
  AdminMatchQualityData,
  AdminOverviewData,
  AdminPipelineData,
  AdminSellerDetailData,
  AnalyticsEnvelope,
  AnalyticsFilters,
  SellerBudgetFitData,
  SellerListingsData,
  SellerMatchTrendData,
  SellerSummaryData,
} from '../types/analytics';

function buildParams(filters: AnalyticsFilters) {
  return {
    from: filters.from,
    to: filters.to,
    city: filters.city,
    locality: filters.locality,
    bhk: filters.bhk,
    propertyType: filters.propertyType,
    sellerType: filters.sellerType,
    minScore: filters.minScore,
    maxScore: filters.maxScore,
  };
}

export const analyticsApi = {
  getAdminOverview: async (filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<AdminOverviewData>>('/analytics/admin/overview', {
      params: buildParams(filters),
    });
    return response.data;
  },
  getAdminPipeline: async (filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<AdminPipelineData>>('/analytics/admin/pipeline', {
      params: buildParams(filters),
    });
    return response.data;
  },
  getAdminMatchQuality: async (filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<AdminMatchQualityData>>('/analytics/admin/match-quality', {
      params: buildParams(filters),
    });
    return response.data;
  },
  getAdminMarketDistribution: async (filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<AdminMarketDistributionData>>('/analytics/admin/market-distribution', {
      params: buildParams(filters),
    });
    return response.data;
  },
  getAdminDemandSupply: async (filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<AdminDemandSupplyData>>('/analytics/admin/demand-supply', {
      params: buildParams(filters),
    });
    return response.data;
  },
  getAdminSellerDetail: async (sellerId: string, filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<AdminSellerDetailData>>(`/analytics/admin/sellers/${sellerId}`, {
      params: buildParams(filters),
    });
    return response.data;
  },
  getSellerSummary: async (filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<SellerSummaryData>>('/analytics/seller/me/summary', {
      params: {
        ...buildParams(filters),
        sellerId: filters.sellerId,
      },
    });
    return response.data;
  },
  getSellerListings: async (filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<SellerListingsData>>('/analytics/seller/me/listings', {
      params: {
        ...buildParams(filters),
        sellerId: filters.sellerId,
      },
    });
    return response.data;
  },
  getSellerBudgetFit: async (filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<SellerBudgetFitData>>('/analytics/seller/me/budget-fit', {
      params: {
        ...buildParams(filters),
        sellerId: filters.sellerId,
      },
    });
    return response.data;
  },
  getSellerMatchTrend: async (filters: AnalyticsFilters) => {
    const response = await api.get<AnalyticsEnvelope<SellerMatchTrendData>>('/analytics/seller/me/match-trend', {
      params: {
        ...buildParams(filters),
        sellerId: filters.sellerId,
      },
    });
    return response.data;
  },
};
