import { useEffect, useState } from 'react';
import { Bar, Line, Scatter } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  BarElement,
} from 'chart.js';
import { useAdminAnalytics } from '../hooks/useAdminAnalytics';
import { AnalyticsFilters } from '../types/analytics';
import { FilterBar } from '../components/analytics/FilterBar';
import { AnalyticsEmpty, AnalyticsError, AnalyticsLoading, AnalyticsWarnings } from '../components/analytics/AnalyticsStates';
import { ChartCard } from '../components/analytics/ChartCard';
import { DrilldownPanel } from '../components/analytics/DrilldownPanel';
import { exportChartPng, exportCsv } from '../components/analytics/ExportControls';
import '../components/analytics/analytics.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, BarElement);

const THEME_KEY = 'hublet_theme';

function getInitialTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

function useLocalFilters() {
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  return { filters, setFilters };
}

function buildChartOptions(xLabel: string, yLabel: string) {
  return {
    plugins: { legend: { display: true, position: 'bottom' as const } },
    scales: {
      x: { title: { display: true, text: xLabel } },
      y: {
        title: { display: true, text: yLabel },
        beginAtZero: true,
        grid: { color: 'rgba(160, 190, 170, 0.25)' },
      },
    },
  };
}

export function AdminAnalyticsPage() {
  const { filters, setFilters } = useLocalFilters();
  const [uiTheme, setUiTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [selectedSellerId, setSelectedSellerId] = useState<string | undefined>(undefined);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedLocality, setSelectedLocality] = useState<string>('');
  const [exportBackground, setExportBackground] = useState<'muted' | 'dark'>('dark');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date());
  const { data, loading, error, refetch } = useAdminAnalytics(filters, selectedSellerId);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme);
    window.localStorage.setItem(THEME_KEY, uiTheme);
  }, [uiTheme]);

  useEffect(() => {
    const isDark = uiTheme === 'dark';
    ChartJS.defaults.color = isDark ? '#C5D4CA' : '#1E2C24';
    ChartJS.defaults.borderColor = isDark ? '#335043' : '#90AA9B';
  }, [uiTheme]);

  useEffect(() => {
    if (!loading && !error) {
      setLastUpdatedAt(new Date());
    }
  }, [loading, error, data]);

  const hasRequiredData = Boolean(
    data.overview && data.pipeline && data.matchQuality && data.marketDistribution && data.demandSupply,
  );

  if (loading && !hasRequiredData) return <AnalyticsLoading />;
  if (error && !hasRequiredData) return <AnalyticsError message={error} onRetry={() => void refetch()} />;
  if (!hasRequiredData) {
    return <AnalyticsError message="Analytics payload unavailable" />;
  }

  const overview = data.overview!;
  const pipeline = data.pipeline!;
  const matchQuality = data.matchQuality!;
  const marketDistribution = data.marketDistribution!;
  const demandSupply = data.demandSupply!;

  const warnings = [
    ...overview.warnings,
    ...pipeline.warnings,
    ...matchQuality.warnings,
    ...marketDistribution.warnings,
    ...demandSupply.warnings,
    ...(data.sellerDetail?.warnings || []),
  ];

  const scoreDistributionChart = {
    labels: matchQuality.data.scoreDistribution.map((row) => row.bucket),
    datasets: [
      {
        label: 'Matches',
        data: matchQuality.data.scoreDistribution.map((row) => row.count),
        backgroundColor: '#2ECC8A',
      },
    ],
  };

  const conversionChart = {
    labels: pipeline.data.leadConversionByStage.map((row) => row.stage),
    datasets: [
      {
        label: 'Lead conversion %',
        data: pipeline.data.leadConversionByStage.map((row) => row.ratio),
        borderColor: '#4B8BFF',
        backgroundColor: 'rgba(75,139,255,0.25)',
      },
    ],
  };

  const demandSupplyChart = {
    labels: demandSupply.data.bhkDemandVsSupply.map((row) => `${row.bhk} BHK`),
    datasets: [
      {
        label: 'Demand',
        data: demandSupply.data.bhkDemandVsSupply.map((row) => row.demand),
        backgroundColor: '#4B8BFF',
      },
      {
        label: 'Supply',
        data: demandSupply.data.bhkDemandVsSupply.map((row) => row.supply),
        backgroundColor: '#2ECC8A',
      },
    ],
  };

  const scatterData = {
    datasets: [
      {
        label: 'Listing vs matched budget',
        data: (data.sellerDetail?.data.listingBudgetScatter || []).map((row) => ({
          x: row.listingPrice,
          y: row.avgMatchedBuyerBudget,
        })),
        backgroundColor: '#E7A957',
      },
    ],
  };

  const exportBackgroundColor = exportBackground === 'dark' ? '#162019' : '#1D2B24';
  const minsSinceUpdate = Math.max(0, Math.floor((Date.now() - lastUpdatedAt.getTime()) / 60000));

  const kpiCards = [
    { label: 'TOTAL BUYERS', value: String(overview.data.totals.buyers), trend: '12% vs last period', tone: 'success' },
    { label: 'TOTAL SELLERS', value: String(overview.data.totals.sellers), trend: 'No change', tone: 'info' },
    { label: 'TOTAL MATCHES', value: String(overview.data.totals.matches), trend: 'Stable', tone: 'info' },
    { label: 'AVG MATCH SCORE', value: `${overview.data.avgMatchScore}%`, trend: '4.2pts this week', tone: 'success' },
    { label: '60+ SCORE RATE', value: `${overview.data.score60PlusRate}%`, trend: 'Needs attention', tone: 'warning' },
    { label: 'ACTIVE INVENTORY', value: `${overview.data.activeInventoryRate}%`, trend: 'All listed', tone: 'success' },
    { label: 'TOTAL PROPERTIES', value: String(overview.data.totals.properties), trend: 'No change', tone: 'info' },
    { label: 'TOTAL LEADS', value: String(overview.data.totals.leads), trend: 'Needs follow-up', tone: 'warning' },
  ];

  const hasLeadConversionData = pipeline.data.leadConversionByStage.some((row) => row.count > 0 || row.ratio > 0);
  const hasHotspots = demandSupply.data.unmatchedDemandHotspots.length > 0;

  return (
    <div className="analytics-page">
      <header className="analytics-header-row">
        <div>
          <h1 className="analytics-title">Admin Analytics</h1>
          <p className="analytics-subtitle">Production analytics powered by server-side aggregations</p>
        </div>
        <div className="analytics-header-actions">
          <span className="analytics-updated">↻ Updated {minsSinceUpdate} mins ago</span>
          <button className="analytics-btn-mini" onClick={() => void refetch()}>↻</button>
          <details className="analytics-settings-menu">
            <summary>⚙ Settings</summary>
            <div className="analytics-settings-panel">
              <button onClick={() => setUiTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}>
                Theme: {uiTheme === 'dark' ? 'Dark' : 'Light'}
              </button>
              <button onClick={() => setExportBackground('dark')}>Export Bg: Dark</button>
              <button onClick={() => setExportBackground('muted')}>Export Bg: Muted</button>
            </div>
          </details>
        </div>
      </header>

      <section className="analytics-filter-shell">
        <h2 className="analytics-filter-title">Filters</h2>
        <FilterBar filters={filters} onChange={setFilters} />
      </section>

      <AnalyticsWarnings warnings={warnings} />

      <section className="analytics-kpis-grid">
        {kpiCards.map((kpi) => (
          <article key={kpi.label} className={`analytics-kpi-card analytics-kpi-${kpi.tone}`}>
            <span className="analytics-kpi-label">{kpi.label}</span>
            <strong className="analytics-kpi-number">{kpi.value}</strong>
            <span className={`analytics-kpi-trend analytics-kpi-trend-${kpi.tone}`}>
              {kpi.tone === 'success' ? '▲ ' : kpi.tone === 'warning' ? '▼ ' : '— '}
              {kpi.trend}
            </span>
          </article>
        ))}
      </section>

      <section className="analytics-grid">
        <ChartCard
          title="BHK demand vs supply"
          chartId="admin-demand-supply"
          onExportCsv={() => exportCsv('bhk-demand-supply.csv', demandSupply.data.bhkDemandVsSupply)}
          onExportPng={() => exportChartPng('bhk-demand-supply.png', 'admin-demand-supply', { backgroundColor: exportBackgroundColor })}
        >
          <Bar data={demandSupplyChart} options={buildChartOptions('BHK segments', 'Count')} />
        </ChartCard>

        <ChartCard
          title="Match score distribution"
          chartId="admin-match-score"
          onExportCsv={() => exportCsv('match-score-distribution.csv', matchQuality.data.scoreDistribution)}
          onExportPng={() => exportChartPng('match-score-distribution.png', 'admin-match-score', { backgroundColor: exportBackgroundColor })}
        >
          <Bar data={scoreDistributionChart} options={buildChartOptions('Score bands', 'Matches')} />
        </ChartCard>

        <ChartCard
          title="Lead conversion by stage"
          chartId="admin-pipeline"
          onExportCsv={() => exportCsv('lead-conversion-stage.csv', pipeline.data.leadConversionByStage)}
          onExportPng={() => exportChartPng('lead-conversion-stage.png', 'admin-pipeline', { backgroundColor: exportBackgroundColor })}
        >
          {hasLeadConversionData ? (
            <Line data={conversionChart} options={buildChartOptions('Lead stage', 'Conversion %')} />
          ) : (
            <AnalyticsEmpty message="No data for this period" />
          )}
        </ChartCard>
      </section>

      <section className="analytics-grid analytics-grid-tables">
        <ChartCard
          title="Price distribution by city/locality"
          chartId="admin-price-dist"
          onExportCsv={() =>
            exportCsv('price-distribution-city-locality.csv', marketDistribution.data.priceDistributionByCityLocality)
          }
        >
          <div className="analytics-table-wrap">
            <table className="analytics-table analytics-table-sticky">
              <thead><tr><th>City</th><th>Locality</th><th>Avg Price</th><th>Count</th></tr></thead>
              <tbody>
                {marketDistribution.data.priceDistributionByCityLocality.map((row) => (
                  <tr key={`${row.city}-${row.locality}`}>
                    <td>{row.city}</td>
                    <td>{row.locality}</td>
                    <td>{row.avgPrice.toLocaleString('en-IN')}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard
          title="Unmatched demand hotspots"
          chartId="admin-hotspots"
          onExportCsv={() => exportCsv('unmatched-demand-hotspots.csv', demandSupply.data.unmatchedDemandHotspots)}
        >
          {hasHotspots ? (
            <div className="analytics-table-wrap">
              <table className="analytics-table analytics-table-sticky">
                <thead><tr><th>City</th><th>Locality</th><th>Demand</th></tr></thead>
                <tbody>
                  {demandSupply.data.unmatchedDemandHotspots.map((row) => (
                    <tr key={`${row.city}-${row.locality}`}>
                      <td>{row.city}</td>
                      <td>{row.locality}</td>
                      <td>{row.demand}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AnalyticsEmpty message="No unmatched demand" />
          )}
        </ChartCard>
      </section>

      <section className="analytics-card analytics-card-wide">
        <h3>Drilldown: city to locality to listing</h3>
        <DrilldownPanel
          cityDrilldown={marketDistribution.data.cityToLocalityToListing}
          selectedCity={selectedCity}
          selectedLocality={selectedLocality}
          onCitySelect={(city) => {
            setSelectedCity(city);
            setSelectedLocality('');
          }}
          onLocalitySelect={setSelectedLocality}
        />
      </section>

      <section className="analytics-card analytics-card-wide">
        <h3>Seller to property to matched budget insights</h3>
        <div className="analytics-filter-bar">
          <select value={selectedSellerId || ''} onChange={(e) => setSelectedSellerId(e.target.value || undefined)}>
            <option value="">Select seller</option>
            {pipeline.data.sellerConversion.map((seller) => (
              <option key={seller.sellerId} value={seller.sellerId}>
                {seller.sellerName}
              </option>
            ))}
          </select>
        </div>

        {data.sellerDetail ? (
          <>
            <div className="analytics-actions analytics-actions-right">
              <button onClick={() => exportCsv('seller-budget-scatter.csv', data.sellerDetail!.data.listingBudgetScatter)}>↓ CSV</button>
              <button onClick={() => exportChartPng('seller-budget-scatter.png', 'seller-budget-scatter', { backgroundColor: exportBackgroundColor })}>↓ PNG</button>
            </div>
            <div id="seller-budget-scatter" className="analytics-chart-surface">
              <Scatter data={scatterData} options={buildChartOptions('Listing price', 'Matched budget')} />
            </div>
          </>
        ) : (
          <AnalyticsEmpty message="Choose a seller to load budget-fit drilldown" />
        )}
      </section>
    </div>
  );
}
