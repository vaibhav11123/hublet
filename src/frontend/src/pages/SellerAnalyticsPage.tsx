import { useEffect, useState } from 'react';
import { Line, Scatter } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { FilterBar } from '../components/analytics/FilterBar';
import { AnalyticsError, AnalyticsLoading, AnalyticsWarnings } from '../components/analytics/AnalyticsStates';
import { ChartCard } from '../components/analytics/ChartCard';
import { exportChartPng, exportCsv } from '../components/analytics/ExportControls';
import { useSellerAnalytics } from '../hooks/useSellerAnalytics';
import { AnalyticsFilters } from '../types/analytics';
import '../components/analytics/analytics.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const THEME_KEY = 'hublet_theme';

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface SellerAnalyticsPageProps {
  impersonatedSellerId?: string;
}

function useLocalFilters(impersonatedSellerId?: string) {
  const [filters, setFilters] = useState<AnalyticsFilters>({ sellerId: impersonatedSellerId });

  useEffect(() => {
    setFilters((prev) => ({ ...prev, sellerId: impersonatedSellerId }));
  }, [impersonatedSellerId]);

  return { filters, setFilters };
}

export function SellerAnalyticsPage({ impersonatedSellerId }: SellerAnalyticsPageProps) {
  const { filters, setFilters } = useLocalFilters(impersonatedSellerId);
  const [uiTheme, setUiTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [exportBackground, setExportBackground] = useState<'muted' | 'dark'>('dark');
  const { data, loading, error, refetch } = useSellerAnalytics(filters);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme);
    window.localStorage.setItem(THEME_KEY, uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    const isDark = uiTheme === 'dark';
    ChartJS.defaults.color = isDark ? '#dbead9' : '#243224';
    ChartJS.defaults.borderColor = isDark ? '#5a7360' : '#8ea08f';
  }, [uiTheme]);

  const hasRequiredData = Boolean(data.summary && data.listings && data.budgetFit && data.matchTrend);

  if (loading && !hasRequiredData) return <AnalyticsLoading />;
  if (error && !hasRequiredData) return <AnalyticsError message={error} onRetry={() => void refetch()} />;
  if (!hasRequiredData) {
    return <AnalyticsError message="Seller analytics payload unavailable" />;
  }

  const summary = data.summary!;
  const listings = data.listings!;
  const budgetFit = data.budgetFit!;
  const matchTrend = data.matchTrend!;

  const trendChart = {
    labels: matchTrend.data.trend.map((row) => row.date),
    datasets: [
      {
        label: 'Average match score',
        data: matchTrend.data.trend.map((row) => row.avgScore),
        borderColor: '#2d7e7e',
      },
    ],
  };

  const scatterData = {
    datasets: [
      {
        label: 'Listing vs matched budget',
        data: budgetFit.data.matchedBudgetScatter.map((row) => ({
          x: row.listingPrice,
          y: row.matchedBuyerBudget,
        })),
        backgroundColor: '#8f5a31',
      },
    ],
  };

  const warnings = [
    ...summary.warnings,
    ...listings.warnings,
    ...budgetFit.warnings,
    ...matchTrend.warnings,
  ];

  const exportBackgroundColor = exportBackground === 'dark' ? '#a9b5a7' : '#c8d1c6';

  return (
    <div className="analytics-page">
      <h1 className="analytics-title">Seller Analytics</h1>
      <p className="analytics-subtitle">Per-seller performance, listings, budget fit, and trend insights.</p>
      <div className="analytics-actions">
        <button onClick={() => setUiTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}>
          Theme: {uiTheme === 'dark' ? 'Dark' : 'Light'}
        </button>
        <button onClick={() => setExportBackground('dark')}>Export Theme: Dark</button>
        <button onClick={() => setExportBackground('muted')}>Export Theme: Muted</button>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />
      <AnalyticsWarnings warnings={warnings} />

      <div className="analytics-kpis">
        <div className="analytics-kpi"><label>Seller</label><strong>{summary.data.sellerName}</strong></div>
        <div className="analytics-kpi"><label>Active listings</label><strong>{summary.data.totals.activeListings}</strong></div>
        <div className="analytics-kpi"><label>Total listings</label><strong>{summary.data.totals.totalListings}</strong></div>
        <div className="analytics-kpi"><label>Matched buyers</label><strong>{summary.data.totals.matchedBuyers}</strong></div>
        <div className="analytics-kpi"><label>Avg score</label><strong>{summary.data.avgScore}%</strong></div>
        <div className="analytics-kpi"><label>Conversion</label><strong>{summary.data.conversionRate}%</strong></div>
        <div className="analytics-kpi"><label>Avg matched buyer budget</label><strong>{summary.data.avgMatchedBuyerBudget.toLocaleString('en-IN')}</strong></div>
        <div className="analytics-kpi"><label>Avg matched property cost</label><strong>{summary.data.avgMatchedPropertyCost.toLocaleString('en-IN')}</strong></div>
      </div>

      <div className="analytics-grid">
        <ChartCard
          title="Listings overview"
          chartId="seller-listings"
          onExportCsv={() => exportCsv('seller-listings.csv', listings.data.listings)}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>City</th>
                  <th>Locality</th>
                  <th>Price</th>
                  <th>Matches</th>
                  <th>Avg Score</th>
                  <th>Budget Fit %</th>
                </tr>
              </thead>
              <tbody>
                {listings.data.listings.map((listing) => (
                  <tr key={listing.propertyId}>
                    <td>{listing.title}</td>
                    <td>{listing.city}</td>
                    <td>{listing.locality}</td>
                    <td>{listing.price.toLocaleString('en-IN')}</td>
                    <td>{listing.matches}</td>
                    <td>{listing.avgMatchScore}</td>
                    <td>{listing.budgetFitRatio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard
          title="Match trend"
          chartId="seller-trend"
          onExportCsv={() => exportCsv('seller-match-trend.csv', matchTrend.data.trend)}
          onExportPng={() => exportChartPng('seller-match-trend.png', 'seller-trend', { backgroundColor: exportBackgroundColor })}
        >
          <Line data={trendChart} />
        </ChartCard>

        <ChartCard
          title="Listing price vs matched budget scatter"
          chartId="seller-scatter"
          onExportCsv={() => exportCsv('seller-budget-scatter.csv', budgetFit.data.matchedBudgetScatter)}
          onExportPng={() => exportChartPng('seller-budget-scatter.png', 'seller-scatter', { backgroundColor: exportBackgroundColor })}
        >
          <Scatter data={scatterData} />
        </ChartCard>
      </div>
    </div>
  );
}
