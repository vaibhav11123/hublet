import { useState, useEffect } from 'react';
import axios from 'axios';
import PropertyForm from './PropertyForm';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface SellerDashboardProps {
    sellerId: string;
    sellerName: string;
    onViewAnalytics?: () => void;
}

interface Property {
    id: string;
    title: string;
    locality: string;
    area: number;
    bhk: number;
    price: number;
    amenities: string[];
    isActive: boolean;
    createdAt: string;
    metadata?: any;
}

interface Match {
    id: string;
    matchScore: number;
    locationScore?: number | null;
    budgetScore?: number | null;
    sizeScore?: number | null;
    amenitiesScore?: number | null;
    buyer: {
        name: string;
        email: string;
        phone?: string;
        localities?: string[] | string;
        areaMin?: number | null;
        areaMax?: number | null;
        bhk?: number | null;
        budgetMin?: number | null;
        budgetMax?: number | null;
        amenities?: string[] | string;
    };
    property: {
        title: string;
    };
}

export const SellerDashboard = ({ sellerId, sellerName, onViewAnalytics }: SellerDashboardProps) => {
    const [properties, setProperties] = useState<Property[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
    const [editingProperty, setEditingProperty] = useState<string | null>(null);
    const [selectedMatchForBreakdown, setSelectedMatchForBreakdown] = useState<Match | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProperties();
    }, [sellerId]);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const [activeRes, soldRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/properties?isActive=true`),
                axios.get(`${API_BASE_URL}/properties?isActive=false`),
            ]);
            const active = (activeRes.data || []).filter((p: any) => p.sellerId === sellerId);
            const sold = (soldRes.data || []).filter((p: any) => p.sellerId === sellerId);
            setProperties([...active, ...sold]);
        } catch (err) {
            console.error('Failed to fetch properties:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMatchesForProperty = async (propertyId: string) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/matches/property/${propertyId}`);
            setMatches(response.data);
            setSelectedProperty(propertyId);
            setSelectedMatchForBreakdown(null);
        } catch (err) {
            console.error('Failed to fetch matches:', err);
        }
    };

    const parseStringArray = (value: unknown): string[] => {
        if (Array.isArray(value)) {
            return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return [];

            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    return parsed.map((item) => String(item).trim()).filter((item) => item.length > 0);
                }
            } catch {
                // Fall back to comma-separated or plain string handling
            }

            if (trimmed.includes(',')) {
                return trimmed.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
            }

            return [trimmed];
        }

        return [];
    };

    const formatPrice = (price?: number | null) => {
        if (!price || Number.isNaN(price)) return 'Not specified';
        if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
        if (price >= 100000) return `₹${(price / 100000).toFixed(2)} Lakhs`;
        return `₹${price.toLocaleString('en-IN')}`;
    };

    const formatBudgetRange = (min?: number | null, max?: number | null) => {
        if (!min && !max) return 'No budget preference';
        if (min && max) return `${formatPrice(min)} to ${formatPrice(max)}`;
        if (min) return `At least ${formatPrice(min)}`;
        return `Up to ${formatPrice(max)}`;
    };

    const formatAreaRange = (min?: number | null, max?: number | null) => {
        if (!min && !max) return 'No area preference';
        if (min && max) return `${min} to ${max} sq ft`;
        if (min) return `At least ${min} sq ft`;
        return `Up to ${max} sq ft`;
    };

    const getScoreText = (score?: number | null) =>
        score !== null && score !== undefined ? `${score.toFixed(1)}%` : 'N/A';

    const getScoreColor = (s: number) => s >= 70 ? 'var(--md-sys-color-success)' : s >= 40 ? 'var(--md-sys-color-warning)' : 'var(--md-sys-color-error)';

    const [soldMessage, setSoldMessage] = useState<string | null>(null);

    const activeProperties = properties.filter(p => p.isActive);
    const soldProperties = properties.filter(p => !p.isActive);

    const selectedPropertyData = selectedProperty
        ? properties.find((property) => property.id === selectedProperty) || null
        : null;

    const buyerLocalities = parseStringArray(selectedMatchForBreakdown?.buyer?.localities);
    const buyerAmenities = parseStringArray(selectedMatchForBreakdown?.buyer?.amenities);
    const propertyAmenities = parseStringArray(selectedPropertyData?.amenities);
    const matchedAmenities = buyerAmenities.filter((amenity) =>
        propertyAmenities.map((item) => item.toLowerCase()).includes(amenity.toLowerCase())
    );

    return (
        <div className="m3-container">
            <h1 className="md-headline-medium" style={{ marginBottom: 20 }}>Seller Dashboard — {sellerName}</h1>

            {onViewAnalytics ? (
                <button
                    onClick={onViewAnalytics}
                    className="m3-btn m3-btn-filled"
                    style={{ marginBottom: 16 }}
                >
                    View Seller Analytics
                </button>
            ) : null}

            <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={`m3-btn ${showAddForm ? 'm3-btn-error-tonal' : 'm3-btn-filled'}`}
                style={{ marginBottom: 20 }}
            >
                {showAddForm ? 'Cancel' : '+ Add New Property'}
            </button>

            {showAddForm && (
                <div className="m3-surface-container" style={{ marginBottom: 24 }}>
                    <PropertyForm fixedSellerId={sellerId} onSuccess={() => {
                        setShowAddForm(false);
                        fetchProperties();
                    }} />
                </div>
            )}

            {soldMessage && <div className="m3-alert m3-alert-success" style={{ marginBottom: 16 }}>{soldMessage}</div>}

            <h2 className="md-title-large" style={{ marginBottom: 16 }}>Active Properties ({activeProperties.length})</h2>

            {loading && <p className="m3-loading">Loading...</p>}

            <div className="m3-grid-cards">
                {activeProperties.map((property) => (
                    editingProperty === property.id ? (
                        <div key={property.id} className="m3-card m3-card-outlined" style={{ borderColor: 'var(--md-sys-color-primary)' }}>
                            <h3 className="md-title-medium" style={{ marginBottom: 16 }}>Edit Property</h3>
                            <PropertyForm
                                fixedSellerId={sellerId}
                                initialData={property}
                                isEditing={true}
                                onSuccess={() => {
                                    setEditingProperty(null);
                                    fetchProperties();
                                }}
                            />
                        </div>
                    ) : (
                        <div key={property.id} className="m3-card m3-card-outlined">
                            <h3 className="md-title-medium">{property.title}</h3>
                            <p className="md-body-medium m3-text-secondary" style={{ marginTop: 4 }}>{property.locality}</p>
                            <p className="md-body-medium" style={{ marginTop: 4, color: 'var(--md-sys-color-on-surface-variant)' }}>{property.bhk} BHK | {property.area} sq ft</p>
                            <p className="md-title-medium m3-text-success" style={{ marginTop: 8, fontWeight: 700 }}>
                                ₹{(property.price / 100000).toFixed(2)} Lakhs
                            </p>
                            <p style={{ marginTop: 4 }}>
                                <span className={`m3-chip ${property.isActive ? 'm3-chip-success' : 'm3-chip-error'}`}>
                                    {property.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </p>
                            {property.metadata?.coordinates?.lat && property.metadata?.coordinates?.lon && (
                                <a
                                    href={`https://www.openstreetmap.org/?mlat=${property.metadata.coordinates.lat}&mlon=${property.metadata.coordinates.lon}#map=16/${property.metadata.coordinates.lat}/${property.metadata.coordinates.lon}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="md-body-small m3-text-primary"
                                    style={{ display: 'inline-block', marginTop: 4, marginBottom: 8 }}
                                >
                                    View on Map
                                </a>
                            )}
                            {property.metadata?.nearbyPlaces && (
                                <div className="m3-surface-container" style={{ marginBottom: 10 }}>
                                    <div className="md-label-medium" style={{ marginBottom: 6, color: 'var(--md-sys-color-on-surface-variant)' }}>Nearby Places</div>
                                    {[
                                        { key: 'airport', label: 'Airport', data: property.metadata.nearbyPlaces.airport },
                                        { key: 'busStation', label: 'Bus Station', data: property.metadata.nearbyPlaces.busStation },
                                        { key: 'trainStation', label: 'Train / Metro', data: property.metadata.nearbyPlaces.trainStation },
                                        { key: 'hospital', label: 'Hospital', data: (property.metadata.nearbyPlaces as any).hospital },
                                    ].map(({ key, label, data }) =>
                                        data ? (
                                            <div key={key} className="m3-flex-between md-body-small" style={{ marginBottom: 4 }}>
                                                <span><strong>{label}:</strong> {data.name}</span>
                                                <span style={{ marginLeft: 8, whiteSpace: 'nowrap', color: 'var(--md-sys-color-on-surface-variant)' }}>
                                                    {data.distanceKm} km{' '}
                                                    <a href={data.osmUrl} target="_blank" rel="noopener noreferrer" className="m3-text-primary">Map</a>
                                                </span>
                                            </div>
                                        ) : null
                                    )}
                                </div>
                            )}
                            {property.metadata?.marketIntel && (
                                <div className="m3-surface-container" style={{ marginBottom: 10 }}>
                                    <div className="md-label-medium" style={{ marginBottom: 6, color: 'var(--md-sys-color-on-surface-variant)' }}>Local Insights</div>
                                    <div className="md-body-small">{property.metadata.marketIntel}</div>
                                </div>
                            )}

                            <div className="m3-flex m3-gap-xs" style={{ marginTop: 12 }}>
                                <button onClick={() => fetchMatchesForProperty(property.id)} className="m3-btn m3-btn-filled m3-btn-sm" style={{ flex: 1 }}>
                                    View Matches
                                </button>
                                <button onClick={() => setEditingProperty(property.id)} className="m3-btn m3-btn-tonal m3-btn-sm" style={{ flex: 1 }}>
                                    Edit
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await axios.put(`${API_BASE_URL}/properties/${property.id}/mark-sold`, {}, {
                                                headers: { Authorization: `Bearer ${localStorage.getItem('hublet_auth_token') || localStorage.getItem('token')}` }
                                            });
                                            setSoldMessage(`✓ "${property.title}" marked as sold`);
                                            setTimeout(() => setSoldMessage(null), 4000);
                                            fetchProperties();
                                        } catch { setSoldMessage(null); }
                                    }}
                                    className="m3-btn m3-btn-error m3-btn-sm"
                                    style={{ flex: 1 }}
                                >
                                    Mark as Sold
                                </button>
                            </div>
                        </div>
                    )
                ))}
            </div>

            {/* Sold Properties */}
            <div style={{ marginTop: 32 }}>
                <h2 className="md-title-large" style={{ marginBottom: 16 }}>Sold Properties ({soldProperties.length})</h2>
                {soldProperties.length === 0 ? (
                    <div className="m3-empty-state">
                        <p>No sold properties yet. When you mark a property as sold, it will appear here.</p>
                    </div>
                ) : (
                    <div className="m3-grid-cards">
                        {soldProperties.map(property => (
                            <div key={property.id} className="m3-card m3-card-outlined m3-card-sold">
                                <h3 className="md-title-medium">{property.title}</h3>
                                <p className="md-body-medium m3-text-secondary" style={{ marginTop: 4 }}>{property.locality}</p>
                                <p className="md-body-medium" style={{ marginTop: 4, color: 'var(--md-sys-color-on-surface-variant)' }}>{property.bhk} BHK | {property.area} sq ft</p>
                                <p className="md-title-medium" style={{ marginTop: 8, fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)' }}>
                                    ₹{(property.price / 100000).toFixed(2)} Lakhs
                                </p>
                                <span className="m3-chip m3-chip-error" style={{ marginTop: 8 }}>Sold</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedProperty && matches.length > 0 && (
                <div style={{ marginTop: 32 }}>
                    <h2 className="md-title-large" style={{ marginBottom: 16 }}>Matches for Selected Property</h2>
                    <div className="m3-table-container">
                        <table className="m3-table">
                            <thead>
                                <tr>
                                    <th>Buyer Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Match Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matches.filter(m => m.buyer).map((match) => (
                                    <tr key={match.id}>
                                        <td style={{ fontWeight: 500 }}>{match.buyer.name}</td>
                                        <td>{match.buyer.email}</td>
                                        <td>{match.buyer.phone || 'N/A'}</td>
                                        <td>
                                            <span className="m3-badge m3-badge-success">{match.matchScore.toFixed(1)}%</span>
                                            <button
                                                onClick={() => setSelectedMatchForBreakdown(match)}
                                                className="m3-btn m3-btn-text m3-btn-sm"
                                                style={{ display: 'block', marginTop: 4, padding: '2px 4px' }}
                                            >
                                                View Breakdown
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedMatchForBreakdown && selectedPropertyData && (
                <div className="m3-scrim" onClick={() => setSelectedMatchForBreakdown(null)}>
                    <div className="m3-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="m3-flex-between" style={{ alignItems: 'start' }}>
                            <div>
                                <h2 className="md-headline-small" style={{ marginBottom: 8 }}>Match Score Breakdown</h2>
                                <p className="md-body-medium m3-text-secondary">
                                    Buyer: <strong>{selectedMatchForBreakdown.buyer.name}</strong> | Property:{' '}
                                    <strong>{selectedPropertyData.title}</strong>
                                </p>
                                <p className="md-body-large m3-text-success" style={{ marginTop: 8, fontWeight: 700 }}>
                                    Total Match Score: {selectedMatchForBreakdown.matchScore.toFixed(1)}%
                                </p>
                            </div>
                            <button onClick={() => setSelectedMatchForBreakdown(null)} className="m3-btn m3-btn-tonal m3-btn-sm">
                                Close
                            </button>
                        </div>

                        <div className="m3-table-container" style={{ marginTop: 18 }}>
                            <table className="m3-table">
                                <thead>
                                    <tr>
                                        <th>Parameter</th>
                                        <th>Score</th>
                                        <th>Buyer Wanted</th>
                                        <th>Property Has</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={{ fontWeight: 600 }}>Location</td>
                                        <td><span style={{ color: selectedMatchForBreakdown.locationScore != null ? getScoreColor(selectedMatchForBreakdown.locationScore) : undefined, fontWeight: 600 }}>{getScoreText(selectedMatchForBreakdown.locationScore)}</span></td>
                                        <td>{buyerLocalities.length > 0 ? buyerLocalities.join(', ') : 'No location preference'}</td>
                                        <td>{selectedPropertyData.locality}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ fontWeight: 600 }}>Budget</td>
                                        <td><span style={{ color: selectedMatchForBreakdown.budgetScore != null ? getScoreColor(selectedMatchForBreakdown.budgetScore) : undefined, fontWeight: 600 }}>{getScoreText(selectedMatchForBreakdown.budgetScore)}</span></td>
                                        <td>{formatBudgetRange(selectedMatchForBreakdown.buyer.budgetMin, selectedMatchForBreakdown.buyer.budgetMax)}</td>
                                        <td>{formatPrice(selectedPropertyData.price)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ fontWeight: 600 }}>Size</td>
                                        <td><span style={{ color: selectedMatchForBreakdown.sizeScore != null ? getScoreColor(selectedMatchForBreakdown.sizeScore) : undefined, fontWeight: 600 }}>{getScoreText(selectedMatchForBreakdown.sizeScore)}</span></td>
                                        <td>
                                            BHK: {selectedMatchForBreakdown.buyer.bhk || 'Any'}
                                            <br />
                                            Area: {formatAreaRange(selectedMatchForBreakdown.buyer.areaMin, selectedMatchForBreakdown.buyer.areaMax)}
                                        </td>
                                        <td>
                                            BHK: {selectedPropertyData.bhk}
                                            <br />
                                            Area: {selectedPropertyData.area} sq ft
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ fontWeight: 600 }}>Amenities</td>
                                        <td><span style={{ color: selectedMatchForBreakdown.amenitiesScore != null ? getScoreColor(selectedMatchForBreakdown.amenitiesScore) : undefined, fontWeight: 600 }}>{getScoreText(selectedMatchForBreakdown.amenitiesScore)}</span></td>
                                        <td>{buyerAmenities.length > 0 ? buyerAmenities.join(', ') : 'No amenities preference'}</td>
                                        <td>{propertyAmenities.length > 0 ? propertyAmenities.join(', ') : 'No amenities listed'}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="m3-surface-container" style={{ marginTop: 14 }}>
                            <strong className="md-label-large">Amenities overlap:</strong>{' '}
                            <span className="md-body-medium">{matchedAmenities.length > 0 ? matchedAmenities.join(', ') : 'No common amenities'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
