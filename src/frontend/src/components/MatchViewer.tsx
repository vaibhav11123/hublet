import { useState, useEffect } from 'react';
import { buyerApi, matchingApi } from '../api/client';

function MatchViewer() {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load buyers for dropdown
    const fetchBuyers = async () => {
      try {
        const response = await buyerApi.getAll();
        setBuyers(response.data);
      } catch (err) {
        console.error('Failed to fetch buyers:', err);
      }
    };
    fetchBuyers();
  }, []);

  const handleFindMatches = async () => {
    if (!selectedBuyerId) {
      setError('Please select a buyer');
      return;
    }

    setLoading(true);
    setError('');
    setMatches([]);

    try {
      const response = await matchingApi.findForBuyer(selectedBuyerId, {
        minScore: 50,
      });
      setMatches(response.data);

      if (response.data.length === 0) {
        setError('No matches found for this buyer. Try adjusting preferences or add more properties.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to find matches');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(price / 100000).toFixed(2)} L`;
  };

  return (
    <div className="m3-card m3-card-elevated">
      <h2 className="md-title-large" style={{ marginBottom: 16 }}>Find Property Matches</h2>

      <div className="m3-input-group">
        <label className="m3-input-label">Select Buyer</label>
        <select
          value={selectedBuyerId}
          onChange={(e) => setSelectedBuyerId(e.target.value)}
          className="m3-input m3-select"
        >
          <option value="">Choose a buyer</option>
          {buyers.map((buyer) => (
            <option key={buyer.id} value={buyer.id}>
              {buyer.name} ({buyer.email})
            </option>
          ))}
        </select>
        {buyers.length === 0 && (
          <small className="md-body-small m3-text-error" style={{ display: 'block', marginTop: 4 }}>
            No buyers found. Please create a buyer first.
          </small>
        )}
      </div>

      <button
        onClick={handleFindMatches}
        className="m3-btn m3-btn-filled"
        disabled={loading || !selectedBuyerId}
      >
        {loading ? 'Finding Matches...' : 'Find Matches'}
      </button>

      {error && <div className="m3-alert m3-alert-error" style={{ marginTop: 16 }}>{error}</div>}

      {matches.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 className="md-title-medium" style={{ marginBottom: 12 }}>Matched Properties ({matches.length})</h3>
          <div className="m3-grid-cards">
            {matches.filter(m => m.property).map((match) => (
              <div key={match.id} className="m3-card m3-card-outlined">
                <div className="m3-flex-between" style={{ marginBottom: 8 }}>
                  <h4 className="md-title-medium">{match.property.title}</h4>
                  <span className="m3-badge m3-badge-success">
                    {match.matchScore.toFixed(1)}%
                  </span>
                </div>

                <p className="md-body-medium m3-text-secondary" style={{ marginBottom: 8 }}>
                  {match.property.locality} • {match.property.bhk} BHK • {match.property.area} sq ft
                </p>
                <p className="md-title-medium m3-text-primary" style={{ fontWeight: 700, marginBottom: 8 }}>
                  {formatPrice(match.property.price)}
                </p>

                {match.property.description && (
                  <p className="md-body-medium" style={{ marginTop: 8, color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {match.property.description}
                  </p>
                )}

                {match.property.amenities && match.property.amenities.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <strong className="md-label-medium">Amenities:</strong>
                    <div className="m3-flex m3-flex-wrap m3-gap-xs" style={{ marginTop: 4 }}>
                      {match.property.amenities.map((a: string, i: number) => (
                        <span key={i} className="m3-chip m3-chip-primary">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="m3-surface-container" style={{ marginTop: 12 }}>
                  <strong className="md-label-medium">Score Breakdown:</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <span className="md-body-small">Location: {match.locationScore?.toFixed(0)}%</span>
                    <span className="md-body-small">Budget: {match.budgetScore?.toFixed(0)}%</span>
                    <span className="md-body-small">Size: {match.sizeScore?.toFixed(0)}%</span>
                    <span className="md-body-small">Amenities: {match.amenitiesScore?.toFixed(0)}%</span>
                  </div>
                </div>

                <div className="md-body-small m3-text-secondary" style={{ marginTop: 8 }}>
                  Seller: {match?.property?.seller?.name || "Unknown"} (Trust Score: {match?.property?.seller?.trustScore || "N/A"})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchViewer;
