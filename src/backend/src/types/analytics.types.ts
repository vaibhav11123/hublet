export type AnalyticsRole = 'admin' | 'seller';

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  city?: string;
  locality?: string;
  bhk?: number;
  propertyType?: string;
  sellerType?: string;
  minScore?: number;
  maxScore?: number;
}

export interface AnalyticsMetadata {
  generatedAt: string;
  filtersApplied: AnalyticsFilters;
  sampleSize: number;
}

export interface AnalyticsResponse<T> {
  metadata: AnalyticsMetadata;
  warnings: string[];
  data: T;
}

export interface AdminOverviewData {
  totals: {
    buyers: number;
    sellers: number;
    properties: number;
    leads: number;
    matches: number;
  };
  avgMatchScore: number;
  score60PlusRate: number;
  activeInventoryRate: number;
  leadConversionByStage: Array<{ stage: string; count: number; ratio: number }>;
}

export interface AdminPipelineData {
  leadConversionByStage: Array<{ stage: string; count: number; ratio: number }>;
  sellerConversion: Array<{ sellerId: string; sellerName: string; convertedLeads: number; totalLeads: number; ratio: number }>;
  topPerformingLocalitiesBySeller: Array<{ sellerId: string; sellerName: string; localities: Array<{ locality: string; convertedLeads: number }> }>;
}

export interface AdminMatchQualityData {
  scoreDistribution: Array<{ bucket: string; count: number }>;
  avgScorePerSeller: Array<{ sellerId: string; sellerName: string; avgScore: number }>;
  trend: Array<{ date: string; avgScore: number; count: number }>;
}

export interface AdminMarketDistributionData {
  priceDistributionByCityLocality: Array<{ city: string; locality: string; avgPrice: number; count: number }>;
  pricePerSqftDistribution: Array<{ city: string; locality: string; avgPricePerSqft: number; count: number }>;
  cityToLocalityToListing: Array<{ city: string; localities: Array<{ locality: string; listings: Array<{ propertyId: string; title: string; sellerId: string; sellerName: string; price: number }> }> }>;
}

export interface AdminDemandSupplyData {
  bhkDemandVsSupply: Array<{ bhk: number; demand: number; supply: number }>;
  unmatchedDemandHotspots: Array<{ city: string; locality: string; demand: number }>;
  buyerBudgetDistributionByCity: Array<{ city: string; min: number; avg: number; max: number; count: number }>;
}

export interface AdminSellerDetailData {
  seller: {
    sellerId: string;
    sellerName: string;
    sellerType: string;
  };
  performance: {
    avgScore: number;
    conversionRate: number;
    avgMatchedBuyerBudget: number;
    avgMatchedPropertyCost: number;
  };
  listingBudgetScatter: Array<{ propertyId: string; title: string; listingPrice: number; avgMatchedBuyerBudget: number }>;
  topLocalities: Array<{ locality: string; convertedLeads: number }>;
  budgetFitByListing: Array<{ propertyId: string; title: string; budgetFitRatio: number }>;
}

export interface SellerSummaryData {
  sellerId: string;
  sellerName: string;
  totals: {
    activeListings: number;
    totalListings: number;
    matchedBuyers: number;
  };
  avgScore: number;
  conversionRate: number;
  avgMatchedBuyerBudget: number;
  avgMatchedPropertyCost: number;
}

export interface SellerListingsData {
  listings: Array<{
    propertyId: string;
    title: string;
    city: string;
    locality: string;
    price: number;
    isActive: boolean;
    matches: number;
    avgMatchScore: number;
    budgetFitRatio: number;
  }>;
}

export interface SellerBudgetFitData {
  sellerBudgetFitRatio: number;
  byListing: Array<{
    propertyId: string;
    title: string;
    listingPrice: number;
    avgMatchedBuyerBudget: number;
    budgetFitRatio: number;
  }>;
  matchedBudgetScatter: Array<{
    propertyId: string;
    propertyTitle: string;
    listingPrice: number;
    matchedBuyerBudget: number;
    buyerId: string;
  }>;
}

export interface SellerMatchTrendData {
  trend: Array<{ date: string; avgScore: number; matches: number }>;
}
