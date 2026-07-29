interface DrilldownPanelProps {
  cityDrilldown: Array<{
    city: string;
    localities: Array<{
      locality: string;
      listings: Array<{ propertyId: string; title: string; sellerId: string; sellerName: string; price: number }>;
    }>;
  }>;
  selectedCity?: string;
  selectedLocality?: string;
  onCitySelect: (city: string) => void;
  onLocalitySelect: (locality: string) => void;
}

export function DrilldownPanel({
  cityDrilldown,
  selectedCity,
  selectedLocality,
  onCitySelect,
  onLocalitySelect,
}: DrilldownPanelProps) {
  const city = cityDrilldown.find((entry) => entry.city === selectedCity);
  const locality = city?.localities.find((entry) => entry.locality === selectedLocality);

  return (
    <section className="analytics-card analytics-drilldown">
      <h3>Drilldown: city to locality to listing</h3>
      <div className="analytics-filter-bar">
        <select value={selectedCity || ''} onChange={(e) => onCitySelect(e.target.value)}>
          <option value="">Select city</option>
          {cityDrilldown.map((entry) => (
            <option key={entry.city} value={entry.city}>
              {entry.city}
            </option>
          ))}
        </select>

        <select value={selectedLocality || ''} onChange={(e) => onLocalitySelect(e.target.value)}>
          <option value="">Select locality</option>
          {(city?.localities || []).map((entry) => (
            <option key={entry.locality} value={entry.locality}>
              {entry.locality}
            </option>
          ))}
        </select>
      </div>

      {locality ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Seller</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {locality.listings.map((listing) => (
                <tr key={listing.propertyId}>
                  <td>{listing.title}</td>
                  <td>{listing.sellerName}</td>
                  <td>{listing.price.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="analytics-empty">Select a locality to view seller and listing drilldown.</div>
      )}
    </section>
  );
}
