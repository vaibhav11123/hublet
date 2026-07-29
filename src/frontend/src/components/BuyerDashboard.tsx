import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BuyerForm from './BuyerForm';
import MapSearchBar from './MapSearchBar';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface BuyerDashboardProps {
    buyerId: string;
    buyerName: string;
}

interface Match {
    id: string;
    matchScore: number;
    locationScore?: number;
    budgetScore?: number;
    sizeScore?: number;
    amenitiesScore?: number;
    property: {
        id: string;
        title: string;
        locality: string;
        area: number;
        bhk: number;
        price: number;
        amenities: string[];
        propertyType: string;
        metadata?: any;
        seller: {
            id: string;
            name: string;
            email: string;
            phone?: string;
            rating: number;
            ratingCount: number;
            trustScore: number;
        };
    };
}

interface BuyerPrefs {
    minBudget?: number;
    maxBudget?: number;
    areaMin?: number;
    areaMax?: number;
    bhk?: number;
    localities: string[];
    amenities: string[];
}

const formatPrice = (price: number): string => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(1)}L`;
    return `₹${price.toLocaleString()}`;
};

const getScoreColor = (score: number): string => {
    if (score >= 75) return 'var(--md-sys-color-success)';
    if (score >= 40) return 'var(--md-sys-color-warning)';
    return 'var(--md-sys-color-error)';
};

export const BuyerDashboard = ({ buyerId, buyerName }: BuyerDashboardProps) => {
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(true);
    const [buyerPrefs, setBuyerPrefs] = useState<BuyerPrefs | null>(null);
    const [activeTab, setActiveTab] = useState<'matches' | 'map'>('matches');
    const [allProperties, setAllProperties] = useState<any[]>([]);

    // Map refs
    const buyerMapRef = useRef<HTMLDivElement>(null);
    const buyerMapInstance = useRef<L.Map | null>(null);

    const fetchBuyerPrefs = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/buyers/${buyerId}`);
            const b = res.data;
            const parseArr = (val: any): string[] => {
                if (Array.isArray(val)) return val;
                if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
                return [];
            };
            setBuyerPrefs({
                minBudget: b.budgetMin ?? undefined,
                maxBudget: b.budgetMax ?? undefined,
                areaMin: b.areaMin ?? undefined,
                areaMax: b.areaMax ?? undefined,
                bhk: b.bhk ?? undefined,
                localities: parseArr(b.localities),
                amenities: parseArr(b.amenities),
            });
        } catch { }
    };

    // Fetch matches on component load
    useEffect(() => {
        fetchMatches();
        fetchBuyerPrefs();
    }, [buyerId]);

    // Fetch all properties when map tab is opened
    useEffect(() => {
        if (activeTab === 'map' && allProperties.length === 0) {
            axios.get(`${API_BASE_URL}/properties`).then(res => {
                setAllProperties(res.data || []);
            }).catch(() => { });
        }
    }, [activeTab]);

    // Build and update the colour-coded map whenever tab is active and data is ready
    useEffect(() => {
        if (activeTab !== 'map') return;

        const el = buyerMapRef.current;
        if (!el) return;

        const matchedIds = new Set(matches.filter(m => m.property).map(m => m.property.id));

        // Destroy previous instance if data changed
        if (buyerMapInstance.current) {
            buyerMapInstance.current.remove();
            buyerMapInstance.current = null;
        }

        const map = L.map(el).setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
        }).addTo(map);
        buyerMapInstance.current = map;

        const bounds: [number, number][] = [];

        const propsWithCoords = allProperties.filter((p: any) => {
            const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {});
            return meta?.coordinates?.lat && meta?.coordinates?.lon;
        });

        propsWithCoords.forEach((p: any) => {
            const meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : (p.metadata || {});
            const lat = meta.coordinates.lat;
            const lon = meta.coordinates.lon;
            const isMatch = matchedIds.has(p.id);

            const color = isMatch ? '#3949AB' : '#899393';
            const label = isMatch ? 'M' : 'P';
            const icon = L.divIcon({
                className: '',
                html: `<div style="background:${color};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:10px;font-weight:bold;">${label}</span></div>`,
                iconSize: [26, 26],
                iconAnchor: [13, 26],
                popupAnchor: [0, -28],
            });

            const priceStr = p.price >= 10000000
                ? `Rs ${(p.price / 10000000).toFixed(2)} Cr`
                : p.price >= 100000
                    ? `Rs ${(p.price / 100000).toFixed(1)} L`
                    : `Rs ${p.price?.toLocaleString('en-IN')}`;

            const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;

            L.marker([lat, lon], { icon })
                .bindPopup(`<div style="min-width:190px;font-family:Inter,sans-serif;"><h4 style="margin:0 0 4px;color:#191C1C;">${p.title}</h4><p style="margin:2px 0;font-size:12px;color:#3F4949;">${p.locality}</p><p style="margin:2px 0;font-size:12px;">${p.bhk} BHK | ${p.area} sqft</p><p style="margin:4px 0;font-size:14px;font-weight:bold;color:#3949AB;">${priceStr}</p>${isMatch ? '<span style="background:#3949AB;color:white;font-size:10px;padding:2px 7px;border-radius:10px;">Matched</span>' : ''}<br/><a href="${osmUrl}" target="_blank" rel="noopener" style="color:#3949AB;font-size:12px;">View on OSM</a></div>`)
                .addTo(map);
            bounds.push([lat, lon]);
        });

        if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });

        return () => { map.remove(); buyerMapInstance.current = null; };
    }, [activeTab, allProperties, matches]);

    const fetchMatches = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/matches/buyer/${buyerId}`);
            setMatches(response.data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch matches');
        } finally {
            setLoading(false);
        }
    };

    const handleFindMatches = async () => {
        setLoading(true);
        setError(null);
        try {
            // Trigger matching algorithm
            const response = await axios.post(`${API_BASE_URL}/matches/buyer/${buyerId}/find`, {
                minScore: 50,
                limit: 50,
            });
            setMatches(response.data);
            setShowForm(false);
        } catch (err: any) {
            setError(err.message || 'Failed to find matches');
        } finally {
            setLoading(false);
        }
    };

    const handlePreferencesUpdated = () => {
        fetchBuyerPrefs();
        handleFindMatches();
    };

    const handleRateSeller = async (sellerId: string, rating: number) => {
        try {
            // Use the same token key used by the app auth utilities
            const token = localStorage.getItem('hublet_auth_token') || localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/sellers/${sellerId}/rate`, { rating }, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            alert('Rating submitted successfully!');
            fetchMatches();
        } catch (err) {
            alert('Failed to rate seller');
        }
    };

    const handleContactAgent = async (sellerId: string) => {
        try {
            // Basic mock since real emailing happens in backend
            const token = localStorage.getItem('hublet_auth_token') || localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/sellers/${sellerId}/contact`,
                { message: 'I am interested in your property', buyerName, buyerEmail: '' },
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            alert('Email sent to seller successfully!');
        } catch (err) {
            alert('Failed to send email to seller');
        }
    };

    return (
        <div className="m3-container">
            <h1 className="md-headline-medium" style={{ marginBottom: 20 }}>Welcome, {buyerName}!</h1>

            {/* Form Section */}
            {showForm && (
                <div style={{ marginBottom: 24 }}>
                    <BuyerForm buyerId={buyerId} onPreferencesUpdated={handlePreferencesUpdated} />
                </div>
            )}

            {!showForm && (
                <button
                    onClick={() => setShowForm(true)}
                    className="m3-btn m3-btn-tonal"
                    style={{ marginBottom: 20 }}
                >
                    Update Preferences
                </button>
            )}

            {/* Tabs */}
            <div className="m3-tabs" style={{ marginBottom: 20 }}>
                <button
                    onClick={() => setActiveTab('matches')}
                    className={`m3-tab ${activeTab === 'matches' ? 'active' : ''}`}
                >
                    Your Matches
                </button>
                <button
                    onClick={() => setActiveTab('map')}
                    className={`m3-tab ${activeTab === 'map' ? 'active' : ''}`}
                >
                    Explore All Properties on Map
                </button>
            </div>

            {activeTab === 'matches' && (
                <>
                    {/* Matches Section */}
                    <div>
                        <div className="m3-flex-between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                            <h2 className="md-title-large">Your Matches ({matches.length})</h2>
                            <button
                                onClick={fetchMatches}
                                disabled={loading}
                                className="m3-btn m3-btn-tonal m3-btn-sm"
                            >
                                {loading ? 'Loading...' : 'Refresh Matches'}
                            </button>
                        </div>

                        {error && <div className="m3-alert m3-alert-error">Error: {error}</div>}

                        {/* Your Preferences Summary */}
                        {buyerPrefs && (buyerPrefs.localities.length > 0 || buyerPrefs.minBudget || buyerPrefs.maxBudget || buyerPrefs.bhk || buyerPrefs.amenities.length > 0) && (
                            <div className="m3-card m3-card-outlined" style={{ padding: '14px 18px', marginBottom: 20 }}>
                                <div className="md-label-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                    Your Search Preferences
                                </div>
                                <div className="m3-flex m3-flex-wrap m3-gap-xs" style={{ alignItems: 'center' }}>
                                    {buyerPrefs.localities.length > 0 && (
                                        <div className="m3-flex m3-gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                            {buyerPrefs.localities.map((loc, i) => (
                                                <span key={i} className="m3-chip m3-chip-primary">{loc}</span>
                                            ))}
                                        </div>
                                    )}
                                    {(buyerPrefs.minBudget || buyerPrefs.maxBudget) && (
                                        <span className="m3-chip m3-chip-success">
                                            {buyerPrefs.minBudget ? formatPrice(buyerPrefs.minBudget) : '–'}
                                            {' → '}
                                            {buyerPrefs.maxBudget ? formatPrice(buyerPrefs.maxBudget) : '–'}
                                        </span>
                                    )}
                                    {buyerPrefs.bhk && (
                                        <span className="m3-chip m3-chip-warning">{buyerPrefs.bhk} BHK</span>
                                    )}
                                    {buyerPrefs.amenities.length > 0 && (
                                        <div className="m3-flex m3-gap-xs" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                            {buyerPrefs.amenities.map((a, i) => (
                                                <span key={i} className="m3-chip m3-chip-filled">{a}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {matches.length === 0 && !loading && (
                            <div className="m3-empty-state">
                                <p>No matches found yet. Update your preferences and click "Find Matches" to see properties!</p>
                            </div>
                        )}

                        <div className="m3-grid-cards">
                            {matches.filter(m => m.property).map((match) => (
                                <div key={match.id} className="m3-card m3-card-outlined">
                                    <div className="m3-flex-between" style={{ alignItems: 'start', marginBottom: 12 }}>
                                        <h3 className="md-title-medium" style={{ marginRight: 12 }}>{match.property.title}</h3>
                                        <span className="m3-badge m3-badge-success">{match.matchScore}%</span>
                                    </div>

                                    <p className="md-body-medium" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginBottom: 8 }}>
                                        {match.property.locality}
                                    </p>

                                    {match.property.metadata?.coordinates?.lat && match.property.metadata?.coordinates?.lon && (
                                        <a
                                            href={`https://www.openstreetmap.org/?mlat=${match.property.metadata.coordinates.lat}&mlon=${match.property.metadata.coordinates.lon}#map=16/${match.property.metadata.coordinates.lat}/${match.property.metadata.coordinates.lon}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="md-body-small m3-text-primary"
                                            style={{ display: 'inline-block', marginBottom: 8 }}
                                        >
                                            View on Map
                                        </a>
                                    )}

                                    {match.property.metadata?.nearbyPlaces && (
                                        <div className="m3-surface-container" style={{ marginBottom: 12 }}>
                                            <div className="md-label-medium m3-text-primary" style={{ marginBottom: 4 }}>Nearby Places</div>
                                            {(['airport', 'busStation', 'trainStation', 'hospital'] as const).map(key => {
                                                const labels: Record<string, string> = { airport: 'Airport', busStation: 'Bus Station', trainStation: 'Train / Metro', hospital: 'Hospital' };
                                                const poi = (match.property.metadata.nearbyPlaces as any)[key];
                                                if (!poi) return null;
                                                return (
                                                    <div key={key} className="m3-flex-between md-body-small" style={{ marginBottom: 2 }}>
                                                        <span><strong>{labels[key]}:</strong> {poi.name}</span>
                                                        <span style={{ color: 'var(--md-sys-color-on-surface-variant)', marginLeft: 8, whiteSpace: 'nowrap' }}>
                                                            {poi.distanceKm} km{' '}
                                                            <a href={poi.osmUrl} target="_blank" rel="noopener noreferrer" className="m3-text-primary">Map</a>
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {match.property.metadata?.marketIntel && (
                                        <div className="m3-surface-container" style={{ marginBottom: 12 }}>
                                            <div className="md-label-medium m3-text-primary" style={{ marginBottom: 4 }}>Local Insights</div>
                                            <div className="md-body-small">{match.property.metadata.marketIntel}</div>
                                        </div>
                                    )}

                                    <div className="m3-flex m3-gap-md md-body-medium" style={{ margin: '12px 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
                                        <span>{match.property.bhk} BHK</span>
                                        <span>{match.property.area} sq.ft</span>
                                        <span>{match.property.propertyType}</span>
                                    </div>

                                    <p className="md-title-large m3-text-success" style={{ margin: '12px 0', fontWeight: 700 }}>
                                        ₹{(match.property.price / 10000000).toFixed(2)} Cr
                                    </p>

                                    {match.property.amenities.length > 0 && (
                                        <div style={{ margin: '12px 0' }}>
                                            <strong className="md-label-medium">Amenities:</strong>
                                            <div className="m3-flex m3-flex-wrap m3-gap-xs" style={{ marginTop: 6 }}>
                                                {match.property.amenities.map((amenity, idx) => (
                                                    <span key={idx} className="m3-chip m3-chip-primary">
                                                        {amenity}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Match Score Breakdown */}
                                    <div className="m3-surface-container" style={{ marginTop: 16 }}>
                                        <strong className="md-label-medium">Match Breakdown:</strong>
                                        <div className="m3-flex-col m3-gap-sm" style={{ marginTop: 12 }}>

                                            {/* Location */}
                                            {match.locationScore !== undefined && (
                                                <div>
                                                    <div className="m3-flex-between" style={{ marginBottom: 4 }}>
                                                        <span className="md-label-medium">Location</span>
                                                        <span className="md-label-medium" style={{ fontWeight: 700, color: getScoreColor(match.locationScore) }}>
                                                            {match.locationScore}%
                                                        </span>
                                                    </div>
                                                    <div className="m3-flex m3-flex-wrap m3-gap-xs" style={{ alignItems: 'center' }}>
                                                        {buyerPrefs && buyerPrefs.localities.length > 0
                                                            ? buyerPrefs.localities.map((loc, i) => {
                                                                const matched =
                                                                    match.property.locality.toLowerCase().includes(loc.toLowerCase()) ||
                                                                    loc.toLowerCase().includes(match.property.locality.toLowerCase());
                                                                return (
                                                                    <span key={i} className={`m3-chip ${matched ? 'm3-chip-success' : ''}`}>
                                                                        {matched ? '✓' : '○'} {loc}
                                                                    </span>
                                                                );
                                                            })
                                                            : null
                                                        }
                                                        <span className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', marginLeft: 2 }}>→ {match.property.locality}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Budget */}
                                            {match.budgetScore !== undefined && (() => {
                                                const price = match.property.price;
                                                const pMin = buyerPrefs?.minBudget || 0;
                                                const pMax = buyerPrefs?.maxBudget || price * 2;
                                                const domainMax = Math.max(pMax, price) * 1.3;
                                                const toP = (v: number) => Math.min(98, Math.max(2, (v / domainMax) * 100));
                                                const inRange = price >= pMin && price <= (buyerPrefs?.maxBudget ?? Infinity);
                                                const hasBudgetPrefs = (buyerPrefs?.minBudget !== undefined && buyerPrefs?.minBudget !== null) ||
                                                    (buyerPrefs?.maxBudget !== undefined && buyerPrefs?.maxBudget !== null);
                                                return (
                                                    <div>
                                                        <div className="m3-flex-between" style={{ marginBottom: 6 }}>
                                                            <span className="md-label-medium">Budget</span>
                                                            <span className="md-label-medium" style={{ fontWeight: 700, color: getScoreColor(match.budgetScore) }}>
                                                                {match.budgetScore}%
                                                            </span>
                                                        </div>
                                                        {hasBudgetPrefs ? (
                                                            <>
                                                                <div style={{ position: 'relative', height: 8, borderRadius: 9999, overflow: 'hidden', background: 'var(--md-sys-color-surface-container-high)' }}>
                                                                    <div style={{
                                                                        position: 'absolute', left: `${toP(pMin)}%`, width: `${toP(pMax) - toP(pMin)}%`,
                                                                        height: '100%', background: 'var(--md-sys-color-primary-container)',
                                                                    }} />
                                                                    <div style={{
                                                                        position: 'absolute', left: `${toP(price)}%`, top: 0,
                                                                        transform: 'translateX(-50%)',
                                                                        width: 8, height: 8,
                                                                        background: inRange ? 'var(--md-sys-color-success)' : 'var(--md-sys-color-warning)',
                                                                        borderRadius: 9999,
                                                                    }} />
                                                                </div>
                                                                <div className="m3-flex-between md-body-small" style={{ marginTop: 4 }}>
                                                                    <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                                                        Your range: {formatPrice(pMin)} – {formatPrice(pMax)}
                                                                    </span>
                                                                    <span style={{ fontWeight: 600, color: inRange ? 'var(--md-sys-color-success)' : 'var(--md-sys-color-warning)' }}>
                                                                        {formatPrice(price)} {inRange ? '✓' : ' over'}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>No specific budget in your preferences</span>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Size / BHK */}
                                            {match.sizeScore !== undefined && (() => {
                                                const area = match.property.area;
                                                const aMin = buyerPrefs?.areaMin || 0;
                                                const aMax = buyerPrefs?.areaMax || area * 2;
                                                const domainMax = Math.max(aMax, area) * 1.3;
                                                const toP = (v: number) => Math.min(98, Math.max(2, (v / domainMax) * 100));
                                                const inRange = area >= aMin && area <= (buyerPrefs?.areaMax ?? Infinity);
                                                const hasSizePrefs = (buyerPrefs?.areaMin !== undefined && buyerPrefs?.areaMin !== null) ||
                                                    (buyerPrefs?.areaMax !== undefined && buyerPrefs?.areaMax !== null) ||
                                                    (buyerPrefs?.bhk !== undefined && buyerPrefs?.bhk !== null);

                                                return (
                                                    <div>
                                                        <div className="m3-flex-between" style={{ marginBottom: 4 }}>
                                                            <span className="md-label-medium">Size</span>
                                                            <span className="md-label-medium" style={{ fontWeight: 700, color: getScoreColor(match.sizeScore) }}>
                                                                {match.sizeScore}%
                                                            </span>
                                                        </div>
                                                        {hasSizePrefs ? (
                                                            <>
                                                                {/* Visual Bar for Area if min/max exists */}
                                                                {(buyerPrefs?.areaMin || buyerPrefs?.areaMax) && (
                                                                    <div style={{ position: 'relative', height: 6, borderRadius: 9999, overflow: 'hidden', margin: '8px 0', background: 'var(--md-sys-color-surface-container-high)' }}>
                                                                        <div style={{
                                                                            position: 'absolute', left: `${toP(aMin)}%`, width: `${toP(aMax) - toP(aMin)}%`,
                                                                            height: '100%', background: 'var(--md-sys-color-tertiary-container)',
                                                                        }} />
                                                                        <div style={{
                                                                            position: 'absolute', left: `${toP(area)}%`, top: 0,
                                                                            transform: 'translateX(-50%)',
                                                                            width: 6, height: 6,
                                                                            background: inRange ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-warning)',
                                                                            borderRadius: 9999,
                                                                        }} />
                                                                    </div>
                                                                )}
                                                                <div className="m3-flex m3-flex-wrap m3-gap-xs md-body-small" style={{ alignItems: 'center' }}>
                                                                    {buyerPrefs?.bhk && (
                                                                        <span className="m3-chip m3-chip-primary">
                                                                            Wanted: {buyerPrefs.bhk} BHK
                                                                        </span>
                                                                    )}
                                                                    {buyerPrefs?.areaMin || buyerPrefs?.areaMax ? (
                                                                        <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>({buyerPrefs.areaMin || 0}-{buyerPrefs.areaMax || '∞'} sq.ft)</span>
                                                                    ) : null}

                                                                    <span style={{ color: 'var(--md-sys-color-outline)' }}>→</span>

                                                                    <span className={`m3-chip ${buyerPrefs?.bhk === match.property.bhk ? 'm3-chip-success' : 'm3-chip-warning'}`}>
                                                                        {buyerPrefs?.bhk != null && buyerPrefs.bhk === match.property.bhk ? '✓ ' : buyerPrefs?.bhk != null ? '~ ' : ''}
                                                                        {match.property.bhk} BHK · {match.property.area} sq.ft
                                                                    </span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>No specific size in your preferences</span>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Amenities */}
                                            {match.amenitiesScore !== undefined && (
                                                <div>
                                                    <div className="m3-flex-between" style={{ marginBottom: 4 }}>
                                                        <span className="md-label-medium">Amenities</span>
                                                        <span className="md-label-medium" style={{ fontWeight: 700, color: getScoreColor(match.amenitiesScore) }}>
                                                            {match.amenitiesScore}%
                                                        </span>
                                                    </div>
                                                    {buyerPrefs && buyerPrefs.amenities.length > 0 ? (
                                                        <div className="m3-flex m3-flex-wrap m3-gap-xs">
                                                            {buyerPrefs.amenities.map((am, i) => {
                                                                const has = match.property.amenities.some(
                                                                    (pa: string) =>
                                                                        pa.toLowerCase().includes(am.toLowerCase()) ||
                                                                        am.toLowerCase().includes(pa.toLowerCase())
                                                                );
                                                                return (
                                                                    <span key={i} className={`m3-chip ${has ? 'm3-chip-success' : 'm3-chip-error'}`}>
                                                                        {has ? '✓' : '✗'} {am}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>No specific amenities in your preferences</span>
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                    </div>

                                    {/* Seller Info */}
                                    {match?.property?.seller && (
                                        <div style={{ marginTop: 16 }}>
                                            <hr className="m3-divider" />
                                            <strong className="md-label-large">Seller:</strong>
                                            <p className="md-body-medium" style={{ margin: '4px 0' }}>
                                                {match.property.seller.name}  {match.property.seller.ratingCount === 0 ? "Not rated" : match.property.seller.rating.toFixed(1)}
                                            </p>
                                            <p className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', margin: '4px 0' }}>
                                                {match.property.seller.email}
                                            </p>
                                            {match.property.seller.phone && (
                                                <p className="md-body-small" style={{ color: 'var(--md-sys-color-on-surface-variant)', margin: '4px 0' }}>
                                                    {match.property.seller.phone}
                                                </p>
                                            )}

                                            <div className="m3-flex-col m3-gap-xs" style={{ marginTop: 10 }}>
                                                <button
                                                    onClick={() => handleContactAgent(match.property.seller.id)}
                                                    className="m3-btn m3-btn-filled m3-btn-sm"
                                                >
                                                    Contact Agent / Email Seller
                                                </button>
                                                <div className="m3-flex m3-gap-xs" style={{ alignItems: 'center' }}>
                                                    <select
                                                        onChange={(e) => {
                                                            const val = Number(e.target.value);
                                                            if (val) handleRateSeller(match.property.seller.id, val);
                                                            e.target.value = "";
                                                        }}
                                                    defaultValue=""
                                                    className="m3-input m3-select m3-input-compact"
                                                    style={{ flex: 1 }}
                                                >
                                                    <option value="" disabled>Rate this seller</option>
                                                    <option value="1">1 Star</option>
                                                    <option value="2">2 Stars</option>
                                                    <option value="3">3 Stars</option>
                                                    <option value="4">4 Stars</option>
                                                        <option value="5">5 Stars</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'map' && (
                <div style={{ marginTop: 10 }}>
                    <div style={{ marginBottom: 10 }}>
                        <MapSearchBar map={buyerMapInstance.current} placeholder="Search for a location on the map..." />
                    </div>
                    <div className="m3-flex m3-gap-md md-body-small m3-card m3-card-outlined" style={{ padding: '8px 14px', width: 'fit-content', marginBottom: 10 }}>
                        <span className="m3-flex m3-gap-xs" style={{ alignItems: 'center' }}>
                            <span style={{ background: 'var(--md-sys-color-primary)', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold' }}>M</span>
                            Matched Properties
                        </span>
                        <span className="m3-flex m3-gap-xs" style={{ alignItems: 'center' }}>
                            <span style={{ background: 'var(--md-sys-color-outline)', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold' }}>P</span>
                            Other Properties
                        </span>
                    </div>
                    <div ref={buyerMapRef} className="m3-map-container" style={{ height: 560 }} />
                </div>
            )}
        </div>
    );
};
