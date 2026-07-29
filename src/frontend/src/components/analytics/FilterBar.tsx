import { AnalyticsFilters } from '../../types/analytics';

interface FilterBarProps {
  filters: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const update = (key: keyof AnalyticsFilters, value: string) => {
    const next: AnalyticsFilters = { ...filters };
    if (value === '') {
      delete next[key];
    } else if (key === 'bhk' || key === 'minScore' || key === 'maxScore') {
      (next[key] as number) = Number(value);
    } else {
      (next[key] as string) = value;
    }
    onChange(next);
  };

  return (
    <div className="analytics-filter-groups">
      <div className="analytics-filter-group">
        <label className="analytics-filter-control">
          <span className="analytics-filter-icon">📅</span>
          <input placeholder="From date" value={filters.from || ''} onChange={(e) => update('from', e.target.value)} />
        </label>
        <label className="analytics-filter-control">
          <span className="analytics-filter-icon">📅</span>
          <input placeholder="To date" value={filters.to || ''} onChange={(e) => update('to', e.target.value)} />
        </label>
      </div>

      <div className="analytics-filter-group">
        <label className="analytics-filter-control">
          <span className="analytics-filter-icon">🏙</span>
          <input placeholder="City" value={filters.city || ''} onChange={(e) => update('city', e.target.value)} />
        </label>
        <label className="analytics-filter-control">
          <span className="analytics-filter-icon">📍</span>
          <input placeholder="Locality" value={filters.locality || ''} onChange={(e) => update('locality', e.target.value)} />
        </label>
        <label className="analytics-filter-control">
          <span className="analytics-filter-icon">🏠</span>
          <input placeholder="BHK" value={filters.bhk || ''} onChange={(e) => update('bhk', e.target.value)} />
        </label>
        <label className="analytics-filter-control">
          <span className="analytics-filter-icon">🏷</span>
          <input placeholder="Property type" value={filters.propertyType || ''} onChange={(e) => update('propertyType', e.target.value)} />
        </label>
        <label className="analytics-filter-control">
          <span className="analytics-filter-icon">👤</span>
          <input placeholder="Seller type" value={filters.sellerType || ''} onChange={(e) => update('sellerType', e.target.value)} />
        </label>
      </div>

      <div className="analytics-filter-group">
        <label className="analytics-filter-control">
          <span className="analytics-filter-icon">⭐</span>
          <input placeholder="Min score" value={filters.minScore || ''} onChange={(e) => update('minScore', e.target.value)} />
        </label>
        <label className="analytics-filter-control">
          <span className="analytics-filter-icon">⭐</span>
          <input placeholder="Max score" value={filters.maxScore || ''} onChange={(e) => update('maxScore', e.target.value)} />
        </label>
      </div>
    </div>
  );
}
