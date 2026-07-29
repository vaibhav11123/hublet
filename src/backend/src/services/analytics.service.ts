import prisma from '../db/prisma';
import {
  AdminDemandSupplyData,
  AdminMarketDistributionData,
  AdminMatchQualityData,
  AdminOverviewData,
  AdminPipelineData,
  AdminSellerDetailData,
  AnalyticsFilters,
  AnalyticsResponse,
  SellerBudgetFitData,
  SellerListingsData,
  SellerMatchTrendData,
  SellerSummaryData,
} from '../types/analytics.types';

type BuyerRow = Awaited<ReturnType<typeof prisma.buyer.findMany>>[number];
type SellerRow = Awaited<ReturnType<typeof prisma.seller.findMany>>[number];
type PropertyRow = Awaited<ReturnType<typeof prisma.property.findMany>>[number] & {
  seller?: SellerRow | null;
};
type LeadRow = Awaited<ReturnType<typeof prisma.lead.findMany>>[number] & {
  buyer?: BuyerRow | null;
  property?: PropertyRow | null;
};
type MatchRow = Awaited<ReturnType<typeof prisma.match.findMany>>[number] & {
  buyer?: BuyerRow | null;
  property?: PropertyRow | null;
};

interface AnalyticsDataset {
  buyers: BuyerRow[];
  sellers: SellerRow[];
  properties: PropertyRow[];
  leads: LeadRow[];
  matches: MatchRow[];
}

interface DatasetWithWarnings {
  dataset: AnalyticsDataset;
  warnings: string[];
}

const LEAD_STAGES = ['NEW', 'ENRICHED', 'QUALIFIED', 'NOTIFIED', 'CONTACTED', 'CLOSED'];

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value: unknown): string {
  if (!value) return '';
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function normalizeText(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function safeParseJsonArray(value: unknown, warnings: string[], warningMessage: string): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry));
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry));
    }
    return [];
  } catch {
    warnings.push(warningMessage);
    return [];
  }
}

function parseFilters(filters: AnalyticsFilters): AnalyticsFilters {
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

function matchFilter(filters: AnalyticsFilters, property: PropertyRow | null | undefined, score: number, createdAt?: Date): boolean {
  const createdDate = createdAt ? new Date(createdAt) : null;
  const fromDate = filters.from ? new Date(filters.from) : null;
  const toDate = filters.to ? new Date(filters.to) : null;

  if (fromDate && createdDate && createdDate < fromDate) return false;
  if (toDate && createdDate && createdDate > toDate) return false;

  if (filters.minScore !== undefined && score < filters.minScore) return false;
  if (filters.maxScore !== undefined && score > filters.maxScore) return false;

  if (!property) return true;

  if (filters.city && normalizeText((property.metadata as any)?.city || '') !== normalizeText(filters.city)) {
    const fallbackCity = normalizeText((property.seller as any)?.metadata?.city || '');
    if (fallbackCity !== normalizeText(filters.city)) {
      return false;
    }
  }

  if (filters.locality && normalizeText(property.locality) !== normalizeText(filters.locality)) return false;
  if (filters.bhk !== undefined && toNumber(property.bhk) !== filters.bhk) return false;
  if (filters.propertyType && normalizeText(property.propertyType) !== normalizeText(filters.propertyType)) return false;
  if (filters.sellerType && normalizeText(property.seller?.sellerType) !== normalizeText(filters.sellerType)) return false;

  return true;
}

function buildResponse<T>(data: T, sampleSize: number, filters: AnalyticsFilters, warnings: string[]): AnalyticsResponse<T> {
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      filtersApplied: parseFilters(filters),
      sampleSize,
    },
    warnings,
    data,
  };
}

async function loadDataset(filters: AnalyticsFilters): Promise<DatasetWithWarnings> {
  const warnings: string[] = [];

  const [buyers, sellers, properties, leads, matches] = await Promise.all([
    prisma.buyer.findMany(),
    prisma.seller.findMany(),
    prisma.property.findMany({ include: { seller: true } }),
    prisma.lead.findMany({ include: { buyer: true, property: { include: { seller: true } } } }),
    prisma.match.findMany({ include: { buyer: true, property: { include: { seller: true } } } }),
  ]);

  const filteredProperties = properties.filter((property) =>
    matchFilter(filters, property as PropertyRow, 0, property.createdAt),
  ) as PropertyRow[];

  const propertyIds = new Set(filteredProperties.map((property) => property.id));

  const filteredLeads = leads.filter((lead) => {
    const belongsToProperty = lead.propertyId ? propertyIds.has(lead.propertyId) : true;
    if (!belongsToProperty) return false;

    const matchScore = toNumber(lead.matchScore);
    return matchFilter(filters, lead.property as PropertyRow | null, matchScore, lead.createdAt);
  }) as LeadRow[];

  const filteredMatches = matches.filter((match) => {
    const belongsToProperty = match.propertyId ? propertyIds.has(match.propertyId) : true;
    if (!belongsToProperty) return false;

    return matchFilter(filters, match.property as PropertyRow | null, toNumber(match.matchScore), match.createdAt);
  }) as MatchRow[];

  return {
    dataset: {
      buyers,
      sellers,
      properties: filteredProperties,
      leads: filteredLeads,
      matches: filteredMatches,
    },
    warnings,
  };
}

function getCityForProperty(property: PropertyRow | null | undefined): string {
  const fromMetadata = normalizeText((property?.metadata as any)?.city);
  if (fromMetadata) return fromMetadata;

  const fallbackSellerCity = normalizeText((property?.seller?.metadata as any)?.city);
  if (fallbackSellerCity) return fallbackSellerCity;

  return 'unknown';
}

function getLeadConversion(leads: LeadRow[]) {
  return LEAD_STAGES.map((stage) => {
    const count = leads.filter((lead) => String(lead.state || '').toUpperCase() === stage).length;
    return {
      stage,
      count,
      ratio: leads.length ? round1((count / leads.length) * 100) : 0,
    };
  });
}

function getSellerIdFromAdminView(sellerId: string, sellers: SellerRow[]): SellerRow | null {
  return sellers.find((seller) => seller.id === sellerId) || null;
}

export class AnalyticsService {
  static async getAdminOverview(filters: AnalyticsFilters): Promise<AnalyticsResponse<AdminOverviewData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const scoreValues = dataset.matches.map((match) => toNumber(match.matchScore)).filter((score) => score > 0);
    const score60 = scoreValues.filter((score) => score >= 60).length;

    const data: AdminOverviewData = {
      totals: {
        buyers: dataset.buyers.length,
        sellers: dataset.sellers.length,
        properties: dataset.properties.length,
        leads: dataset.leads.length,
        matches: dataset.matches.length,
      },
      avgMatchScore: round1(average(scoreValues)),
      score60PlusRate: scoreValues.length ? round1((score60 / scoreValues.length) * 100) : 0,
      activeInventoryRate: dataset.properties.length
        ? round1((dataset.properties.filter((property) => property.isActive).length / dataset.properties.length) * 100)
        : 0,
      leadConversionByStage: getLeadConversion(dataset.leads),
    };

    return buildResponse(data, dataset.matches.length, filters, warnings);
  }

  static async getAdminPipeline(filters: AnalyticsFilters): Promise<AnalyticsResponse<AdminPipelineData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const conversionByStage = getLeadConversion(dataset.leads);

    const leadsBySeller = new Map<string, LeadRow[]>();
    dataset.leads.forEach((lead) => {
      const sellerId = lead.property?.sellerId;
      if (!sellerId) return;
      const list = leadsBySeller.get(sellerId) || [];
      list.push(lead);
      leadsBySeller.set(sellerId, list);
    });

    const sellerConversion = dataset.sellers.map((seller) => {
      const sellerLeads = leadsBySeller.get(seller.id) || [];
      const converted = sellerLeads.filter((lead) => String(lead.state || '').toUpperCase() === 'CLOSED').length;
      return {
        sellerId: seller.id,
        sellerName: seller.name,
        convertedLeads: converted,
        totalLeads: sellerLeads.length,
        ratio: sellerLeads.length ? round1((converted / sellerLeads.length) * 100) : 0,
      };
    });

    const topPerformingLocalitiesBySeller = dataset.sellers.map((seller) => {
      const localityMap = new Map<string, number>();
      (leadsBySeller.get(seller.id) || [])
        .filter((lead) => String(lead.state || '').toUpperCase() === 'CLOSED')
        .forEach((lead) => {
          const locality = normalizeText(lead.property?.locality) || 'unknown';
          localityMap.set(locality, (localityMap.get(locality) || 0) + 1);
        });

      const localities = [...localityMap.entries()]
        .map(([locality, convertedLeads]) => ({ locality, convertedLeads }))
        .sort((a, b) => b.convertedLeads - a.convertedLeads)
        .slice(0, 5);

      return {
        sellerId: seller.id,
        sellerName: seller.name,
        localities,
      };
    });

    return buildResponse(
      {
        leadConversionByStage: conversionByStage,
        sellerConversion,
        topPerformingLocalitiesBySeller,
      },
      dataset.leads.length,
      filters,
      warnings,
    );
  }

  static async getAdminMatchQuality(filters: AnalyticsFilters): Promise<AnalyticsResponse<AdminMatchQualityData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const buckets = [
      { label: '0-19', min: 0, max: 19 },
      { label: '20-39', min: 20, max: 39 },
      { label: '40-59', min: 40, max: 59 },
      { label: '60-79', min: 60, max: 79 },
      { label: '80-100', min: 80, max: 100 },
    ];

    const scoreDistribution = buckets.map((bucket) => ({
      bucket: bucket.label,
      count: dataset.matches.filter((match) => {
        const score = toNumber(match.matchScore);
        return score >= bucket.min && score <= bucket.max;
      }).length,
    }));

    const sellerScoreMap = new Map<string, number[]>();
    dataset.matches.forEach((match) => {
      const sellerId = match.property?.sellerId;
      if (!sellerId) return;
      const list = sellerScoreMap.get(sellerId) || [];
      list.push(toNumber(match.matchScore));
      sellerScoreMap.set(sellerId, list);
    });

    const avgScorePerSeller = dataset.sellers.map((seller) => {
      const scores = sellerScoreMap.get(seller.id) || [];
      return {
        sellerId: seller.id,
        sellerName: seller.name,
        avgScore: round1(average(scores.filter((score) => score > 0))),
      };
    });

    const trendMap = new Map<string, number[]>();
    dataset.matches.forEach((match) => {
      const dateKey = toIsoDate(match.createdAt);
      if (!dateKey) return;
      const list = trendMap.get(dateKey) || [];
      list.push(toNumber(match.matchScore));
      trendMap.set(dateKey, list);
    });

    const trend = [...trendMap.entries()]
      .map(([date, scores]) => ({
        date,
        avgScore: round1(average(scores)),
        count: scores.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return buildResponse(
      { scoreDistribution, avgScorePerSeller, trend },
      dataset.matches.length,
      filters,
      warnings,
    );
  }

  static async getAdminMarketDistribution(
    filters: AnalyticsFilters,
  ): Promise<AnalyticsResponse<AdminMarketDistributionData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const cityLocalityPrices = new Map<string, number[]>();
    const cityLocalitySqft = new Map<string, number[]>();

    dataset.properties.forEach((property) => {
      const city = getCityForProperty(property);
      const locality = normalizeText(property.locality) || 'unknown';
      const key = `${city}::${locality}`;
      const priceList = cityLocalityPrices.get(key) || [];
      const price = toNumber(property.price);
      if (price > 0) {
        priceList.push(price);
        cityLocalityPrices.set(key, priceList);
      }

      const area = toNumber(property.area);
      if (area > 0 && price > 0) {
        const sqftList = cityLocalitySqft.get(key) || [];
        sqftList.push(price / area);
        cityLocalitySqft.set(key, sqftList);
      }
    });

    const priceDistributionByCityLocality = [...cityLocalityPrices.entries()].map(([key, prices]) => {
      const [city, locality] = key.split('::');
      return {
        city,
        locality,
        avgPrice: round1(average(prices)),
        count: prices.length,
      };
    });

    const pricePerSqftDistribution = [...cityLocalitySqft.entries()].map(([key, prices]) => {
      const [city, locality] = key.split('::');
      return {
        city,
        locality,
        avgPricePerSqft: round1(average(prices)),
        count: prices.length,
      };
    });

    const cityMap = new Map<string, Map<string, Array<{ propertyId: string; title: string; sellerId: string; sellerName: string; price: number }>>>();
    dataset.properties.forEach((property) => {
      const city = getCityForProperty(property);
      const locality = normalizeText(property.locality) || 'unknown';
      const sellerId = property.sellerId || 'unknown';
      const sellerName = property.seller?.name || 'unknown';
      if (!cityMap.has(city)) cityMap.set(city, new Map());
      const localityMap = cityMap.get(city)!;
      const listings = localityMap.get(locality) || [];
      listings.push({
        propertyId: property.id,
        title: property.title,
        sellerId,
        sellerName,
        price: toNumber(property.price),
      });
      localityMap.set(locality, listings);
    });

    const cityToLocalityToListing = [...cityMap.entries()].map(([city, localities]) => ({
      city,
      localities: [...localities.entries()].map(([locality, listings]) => ({ locality, listings })),
    }));

    return buildResponse(
      {
        priceDistributionByCityLocality,
        pricePerSqftDistribution,
        cityToLocalityToListing,
      },
      dataset.properties.length,
      filters,
      warnings,
    );
  }

  static async getAdminDemandSupply(filters: AnalyticsFilters): Promise<AnalyticsResponse<AdminDemandSupplyData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const sellerWarnings: string[] = [];
    const bhkSet = new Set<number>();
    dataset.buyers.forEach((buyer) => bhkSet.add(toNumber((buyer as any).bhk)));
    dataset.properties.forEach((property) => bhkSet.add(toNumber(property.bhk)));

    const bhkDemandVsSupply = [...bhkSet]
      .filter((bhk) => bhk > 0)
      .sort((a, b) => a - b)
      .map((bhk) => ({
        bhk,
        demand: dataset.buyers.filter((buyer) => toNumber((buyer as any).bhk) === bhk).length,
        supply: dataset.properties.filter((property) => toNumber(property.bhk) === bhk).length,
      }));

    const localDemand = new Map<string, number>();
    dataset.buyers.forEach((buyer) => {
      const localities = safeParseJsonArray((buyer as any).metadata ? (JSON.parse((buyer as any).metadata || '{}') as any).localities : [], sellerWarnings, 'Buyer metadata localities could not be parsed for one or more rows');
      const city = normalizeText((buyer as any).metadata ? (JSON.parse((buyer as any).metadata || '{}') as any).city : '') || 'unknown';
      localities.forEach((locality) => {
        const key = `${city}::${normalizeText(locality)}`;
        localDemand.set(key, (localDemand.get(key) || 0) + 1);
      });
    });

    const localSupply = new Set<string>();
    dataset.properties.forEach((property) => {
      const key = `${getCityForProperty(property)}::${normalizeText(property.locality) || 'unknown'}`;
      localSupply.add(key);
    });

    const unmatchedDemandHotspots = [...localDemand.entries()]
      .filter(([key]) => !localSupply.has(key))
      .map(([key, demand]) => {
        const [city, locality] = key.split('::');
        return { city, locality, demand };
      })
      .sort((a, b) => b.demand - a.demand)
      .slice(0, 20);

    const cityBudgets = new Map<string, number[]>();
    dataset.buyers.forEach((buyer) => {
      const metadata = (() => {
        try {
          return (buyer as any).metadata ? JSON.parse((buyer as any).metadata) : {};
        } catch {
          warnings.push('Buyer metadata JSON parse failed for one or more rows');
          return {};
        }
      })();
      const city = normalizeText(metadata.city) || 'unknown';
      const budget = toNumber((buyer as any).budgetMax || (buyer as any).budgetMin);
      if (!budget) return;
      const list = cityBudgets.get(city) || [];
      list.push(budget);
      cityBudgets.set(city, list);
    });

    const buyerBudgetDistributionByCity = [...cityBudgets.entries()].map(([city, values]) => ({
      city,
      min: values.length ? Math.min(...values) : 0,
      avg: round1(average(values)),
      max: values.length ? Math.max(...values) : 0,
      count: values.length,
    }));

    warnings.push(...sellerWarnings);

    return buildResponse(
      {
        bhkDemandVsSupply,
        unmatchedDemandHotspots,
        buyerBudgetDistributionByCity,
      },
      dataset.buyers.length + dataset.properties.length,
      filters,
      warnings,
    );
  }

  static async getAdminSellerDetail(
    sellerId: string,
    filters: AnalyticsFilters,
  ): Promise<AnalyticsResponse<AdminSellerDetailData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const seller = getSellerIdFromAdminView(sellerId, dataset.sellers);
    if (!seller) {
      warnings.push(`Seller ${sellerId} not found`);
    }

    const sellerProperties = dataset.properties.filter((property) => property.sellerId === sellerId);
    const sellerPropertyIds = new Set(sellerProperties.map((property) => property.id));
    const sellerMatches = dataset.matches.filter((match) => sellerPropertyIds.has(match.propertyId));
    const sellerLeads = dataset.leads.filter((lead) => sellerPropertyIds.has(lead.propertyId));

    const listingBudgetScatter = sellerProperties.map((property) => {
      const listingMatches = sellerMatches.filter((match) => match.propertyId === property.id);
      const matchedBuyerBudgets = listingMatches
        .map((match) => toNumber(match.buyer?.budgetMax || match.buyer?.budgetMin))
        .filter((budget) => budget > 0);

      return {
        propertyId: property.id,
        title: property.title,
        listingPrice: toNumber(property.price),
        avgMatchedBuyerBudget: round1(average(matchedBuyerBudgets)),
      };
    });

    const localityMap = new Map<string, number>();
    sellerLeads
      .filter((lead) => String(lead.state || '').toUpperCase() === 'CLOSED')
      .forEach((lead) => {
        const locality = normalizeText(lead.property?.locality) || 'unknown';
        localityMap.set(locality, (localityMap.get(locality) || 0) + 1);
      });

    const topLocalities = [...localityMap.entries()]
      .map(([locality, convertedLeads]) => ({ locality, convertedLeads }))
      .sort((a, b) => b.convertedLeads - a.convertedLeads)
      .slice(0, 8);

    const budgetFitByListing = listingBudgetScatter.map((row) => ({
      propertyId: row.propertyId,
      title: row.title,
      budgetFitRatio: row.listingPrice > 0 ? round1((row.avgMatchedBuyerBudget / row.listingPrice) * 100) : 0,
    }));

    const avgScore = round1(average(sellerMatches.map((match) => toNumber(match.matchScore)).filter((score) => score > 0)));
    const conversionRate = sellerLeads.length
      ? round1(
          (sellerLeads.filter((lead) => String(lead.state || '').toUpperCase() === 'CLOSED').length / sellerLeads.length) * 100,
        )
      : 0;
    const avgMatchedBuyerBudget = round1(
      average(
        sellerMatches
          .map((match) => toNumber(match.buyer?.budgetMax || match.buyer?.budgetMin))
          .filter((budget) => budget > 0),
      ),
    );
    const avgMatchedPropertyCost = round1(
      average(sellerMatches.map((match) => toNumber(match.property?.price)).filter((price) => price > 0)),
    );

    return buildResponse(
      {
        seller: {
          sellerId,
          sellerName: seller?.name || 'unknown',
          sellerType: seller?.sellerType || 'unknown',
        },
        performance: {
          avgScore,
          conversionRate,
          avgMatchedBuyerBudget,
          avgMatchedPropertyCost,
        },
        listingBudgetScatter,
        topLocalities,
        budgetFitByListing,
      },
      sellerMatches.length,
      filters,
      warnings,
    );
  }

  static async getSellerSummary(
    sellerId: string,
    filters: AnalyticsFilters,
  ): Promise<AnalyticsResponse<SellerSummaryData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const seller = getSellerIdFromAdminView(sellerId, dataset.sellers);
    if (!seller) {
      warnings.push(`Seller ${sellerId} not found`);
    }

    const sellerProperties = dataset.properties.filter((property) => property.sellerId === sellerId);
    const sellerPropertyIds = new Set(sellerProperties.map((property) => property.id));
    const sellerMatches = dataset.matches.filter((match) => sellerPropertyIds.has(match.propertyId));
    const sellerLeads = dataset.leads.filter((lead) => sellerPropertyIds.has(lead.propertyId));

    return buildResponse(
      {
        sellerId,
        sellerName: seller?.name || 'unknown',
        totals: {
          activeListings: sellerProperties.filter((property) => property.isActive).length,
          totalListings: sellerProperties.length,
          matchedBuyers: new Set(sellerMatches.map((match) => match.buyerId)).size,
        },
        avgScore: round1(average(sellerMatches.map((match) => toNumber(match.matchScore)).filter((score) => score > 0))),
        conversionRate: sellerLeads.length
          ? round1(
              (sellerLeads.filter((lead) => String(lead.state || '').toUpperCase() === 'CLOSED').length / sellerLeads.length) *
                100,
            )
          : 0,
        avgMatchedBuyerBudget: round1(
          average(
            sellerMatches
              .map((match) => toNumber(match.buyer?.budgetMax || match.buyer?.budgetMin))
              .filter((budget) => budget > 0),
          ),
        ),
        avgMatchedPropertyCost: round1(
          average(sellerMatches.map((match) => toNumber(match.property?.price)).filter((price) => price > 0)),
        ),
      },
      sellerMatches.length,
      filters,
      warnings,
    );
  }

  static async getSellerListings(
    sellerId: string,
    filters: AnalyticsFilters,
  ): Promise<AnalyticsResponse<SellerListingsData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const sellerProperties = dataset.properties.filter((property) => property.sellerId === sellerId);
    const sellerMatches = dataset.matches.filter((match) => match.property?.sellerId === sellerId);

    const listings = sellerProperties.map((property) => {
      const propertyMatches = sellerMatches.filter((match) => match.propertyId === property.id);
      const avgScore = round1(
        average(propertyMatches.map((match) => toNumber(match.matchScore)).filter((score) => score > 0)),
      );
      const avgMatchedBudget = round1(
        average(
          propertyMatches
            .map((match) => toNumber(match.buyer?.budgetMax || match.buyer?.budgetMin))
            .filter((budget) => budget > 0),
        ),
      );

      return {
        propertyId: property.id,
        title: property.title,
        city: getCityForProperty(property),
        locality: normalizeText(property.locality) || 'unknown',
        price: toNumber(property.price),
        isActive: property.isActive,
        matches: propertyMatches.length,
        avgMatchScore: avgScore,
        budgetFitRatio: property.price ? round1((avgMatchedBudget / toNumber(property.price)) * 100) : 0,
      };
    });

    return buildResponse({ listings }, listings.length, filters, warnings);
  }

  static async getSellerBudgetFit(
    sellerId: string,
    filters: AnalyticsFilters,
  ): Promise<AnalyticsResponse<SellerBudgetFitData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const sellerProperties = dataset.properties.filter((property) => property.sellerId === sellerId);
    const sellerPropertyIds = new Set(sellerProperties.map((property) => property.id));
    const sellerMatches = dataset.matches.filter((match) => sellerPropertyIds.has(match.propertyId));

    const byListing = sellerProperties.map((property) => {
      const propertyMatches = sellerMatches.filter((match) => match.propertyId === property.id);
      const matchedBuyerBudgets = propertyMatches
        .map((match) => toNumber(match.buyer?.budgetMax || match.buyer?.budgetMin))
        .filter((budget) => budget > 0);
      const avgMatchedBuyerBudget = round1(average(matchedBuyerBudgets));
      return {
        propertyId: property.id,
        title: property.title,
        listingPrice: toNumber(property.price),
        avgMatchedBuyerBudget,
        budgetFitRatio: property.price ? round1((avgMatchedBuyerBudget / toNumber(property.price)) * 100) : 0,
      };
    });

    const matchedBudgetScatter = sellerMatches.map((match) => ({
      propertyId: match.propertyId,
      propertyTitle: match.property?.title || 'unknown',
      listingPrice: toNumber(match.property?.price),
      matchedBuyerBudget: toNumber(match.buyer?.budgetMax || match.buyer?.budgetMin),
      buyerId: match.buyerId,
    }));

    const sellerBudgetFitRatio = round1(average(byListing.map((row) => row.budgetFitRatio).filter((ratio) => ratio > 0)));

    return buildResponse(
      {
        sellerBudgetFitRatio,
        byListing,
        matchedBudgetScatter,
      },
      byListing.length,
      filters,
      warnings,
    );
  }

  static async getSellerMatchTrend(
    sellerId: string,
    filters: AnalyticsFilters,
  ): Promise<AnalyticsResponse<SellerMatchTrendData>> {
    const { dataset, warnings } = await loadDataset(filters);

    const sellerProperties = new Set(
      dataset.properties.filter((property) => property.sellerId === sellerId).map((property) => property.id),
    );

    const trendMap = new Map<string, number[]>();
    dataset.matches
      .filter((match) => sellerProperties.has(match.propertyId))
      .forEach((match) => {
        const date = toIsoDate(match.createdAt);
        if (!date) return;
        const list = trendMap.get(date) || [];
        list.push(toNumber(match.matchScore));
        trendMap.set(date, list);
      });

    const trend = [...trendMap.entries()]
      .map(([date, scores]) => ({
        date,
        avgScore: round1(average(scores)),
        matches: scores.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return buildResponse({ trend }, trend.length, filters, warnings);
  }
}
