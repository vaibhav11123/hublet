import { useState, useEffect, useRef } from 'react';
import { propertyApi, sellerApi } from '../api/client';
import LocationPicker, { PickedLocation } from './LocationPicker';

interface NearbyPlace {
    name: string;
    distanceKm: number;
    lat: number;
    lon: number;
    osmUrl: string;
}

interface NearbyPlaces {
    airport?: NearbyPlace;
    busStation?: NearbyPlace;
    trainStation?: NearbyPlace;
    hospital?: NearbyPlace;
    fetchedAt?: string;
}

interface PropertyFormProps {
    onSuccess?: () => void;
    fixedSellerId?: string;
    initialData?: any;
    isEditing?: boolean;
}

const POI_ROWS: Array<{ key: keyof NearbyPlaces; label: string; icon: string }> = [
    { key: 'airport', label: 'Nearest Airport', icon: '✈' },
    { key: 'busStation', label: 'Nearest Bus Station', icon: '🚌' },
    { key: 'trainStation', label: 'Nearest Train / Metro', icon: '🚉' },
    { key: 'hospital', label: 'Nearest Hospital', icon: '🏥' },
];

function PropertyForm({ onSuccess, fixedSellerId, initialData, isEditing }: PropertyFormProps = {}) {
    const [sellers, setSellers] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        sellerId: fixedSellerId || initialData?.sellerId || '',
        title: initialData?.title || '',
        description: initialData?.description || '',
        locality: initialData?.locality || '',
        address: initialData?.metadata?.address || '',
        area: initialData?.area || 0,
        bhk: initialData?.bhk || 2,
        price: initialData?.price || 0,
        amenities: initialData?.amenities ? initialData.amenities.join(', ') : '',
        propertyType: initialData?.propertyType || 'apartment',
        contact: initialData?.metadata?.contact || '',
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);

    // POI state — pre-seeded from initialData so edit mode shows existing POIs
    const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlaces | null>(
        initialData?.metadata?.nearbyPlaces || null,
    );
    const [poiLoading, setPoiLoading] = useState(false);
    const [poiError, setPoiError] = useState('');
    const poiFetchRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (fixedSellerId) {
            setFormData(prev => ({ ...prev, sellerId: fixedSellerId }));
            return;
        }
        sellerApi.getAll()
            .then(r => setSellers(r.data))
            .catch(err => console.error('Failed to fetch sellers:', err));
    }, [fixedSellerId]);

    // ── submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const amenitiesArray = formData.amenities
                .split(',')
                .map((a: string) => a.trim())
                .filter((a: string) => a.length > 0);

            const metadata: any = {};
            if (pickedLocation) metadata.coordinates = { lat: pickedLocation.lat, lon: pickedLocation.lon };
            if (nearbyPlaces) metadata.nearbyPlaces = nearbyPlaces;

            const payload = {
                ...formData,
                amenities: amenitiesArray,
                contact: formData.contact || undefined,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            };

            let response;
            if (isEditing && initialData?.id) {
                payload.metadata = { ...(initialData.metadata || {}), ...payload.metadata };
                response = await propertyApi.update(initialData.id, payload);
                setMessage('Property updated successfully!');
            } else {
                response = await propertyApi.create(payload);
                setMessage(`Property created successfully! ID: ${response.data.id}`);
            }

            if (onSuccess) onSuccess();

            setFormData({
                sellerId: fixedSellerId || formData.sellerId,
                title: '', description: '', locality: '', address: '',
                area: 0, bhk: 2, price: 0, amenities: '', propertyType: 'apartment', contact: '',
            });
            setPickedLocation(null);
            setNearbyPlaces(null);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create property');
        } finally {
            setLoading(false);
        }
    };

    // ── map location change → fetch POIs ─────────────────────────────────────
    const handleLocationChange = async (locations: PickedLocation[]) => {
        if (locations.length === 0) {
            setPickedLocation(null);
            setNearbyPlaces(null);
            setPoiError('');
            return;
        }

        const loc = locations[0];
        setPickedLocation(loc);
        setFormData(prev => ({
            ...prev,
            locality: loc.name,
            address: loc.address || prev.address,
        }));

        // Abort in-flight fetch
        if (poiFetchRef.current) poiFetchRef.current.abort();
        poiFetchRef.current = new AbortController();

        setPoiLoading(true);
        setNearbyPlaces(null);
        setPoiError('');
        try {
            const res = await propertyApi.getNearbyPlaces(
                loc.lat,
                loc.lon,
                poiFetchRef.current.signal,
            );
            setNearbyPlaces(res.data);
        } catch (err: any) {
            if (err?.name !== 'CanceledError' && err?.code !== 'ERR_CANCELED') {
                console.error('[PropertyForm] POI fetch failed:', err);
                setPoiError('Could not load nearby places. Please try again in a moment.');
            }
        } finally {
            setPoiLoading(false);
        }
    };

    const handleRetryPoi = () => {
        if (!pickedLocation) return;
        handleLocationChange([pickedLocation]);
    };

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="m3-card m3-card-elevated">
            <h2 className="md-title-large" style={{ marginBottom: 20 }}>{isEditing ? 'Edit Property' : 'Add Property Listing'}</h2>
            <form onSubmit={handleSubmit}>

                {/* Seller selector */}
                {fixedSellerId ? (
                    <div className="m3-input-group">
                        <label className="m3-input-label m3-input-label-required">Seller</label>
                        <input type="text" value="Current logged-in seller" disabled className="m3-input" />
                    </div>
                ) : (
                    <div className="m3-input-group">
                        <label className="m3-input-label m3-input-label-required">Seller</label>
                        <select
                            required
                            value={formData.sellerId}
                            onChange={e => setFormData({ ...formData, sellerId: e.target.value })}
                            className="m3-input m3-select"
                        >
                            <option value="">Select a seller</option>
                            {sellers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                            ))}
                        </select>
                        {sellers.length === 0 && (
                            <small className="md-body-small m3-text-error" style={{ display: 'block', marginTop: 4 }}>No sellers found. Please create a seller first.</small>
                        )}
                    </div>
                )}

                <div className="m3-input-group">
                    <label className="m3-input-label m3-input-label-required">Title</label>
                    <input
                        type="text" required
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g., Spacious 2BHK in Indiranagar"
                        className="m3-input"
                    />
                </div>

                <div className="m3-input-group">
                    <label className="m3-input-label">Description</label>
                    <textarea
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed property description..."
                        className="m3-input"
                    />
                </div>

                {/* ── Map-based Location Picker ──────────────────────────────── */}
                <div className="m3-surface-container" style={{ marginBottom: 16, border: '1px solid var(--md-sys-color-outline-variant)' }}>
                    <div className="m3-flex-between" style={{ marginBottom: 10 }}>
                        <div>
                            <label className="md-title-small" style={{ display: 'block' }}>Property Location</label>
                            <p className="md-body-small m3-text-secondary" style={{ marginTop: 2 }}>
                                Pin on map to auto-fill locality and nearby places, or type manually below
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowMap(!showMap)}
                            className={`m3-btn m3-btn-sm ${showMap ? 'm3-btn-error-tonal' : 'm3-btn-filled'}`}
                        >
                            {showMap ? 'Hide Map' : 'Pick on Map'}
                        </button>
                    </div>

                    {showMap && (
                        <div style={{ marginBottom: 12 }}>
                            <LocationPicker
                                mode="single"
                                initialLocations={pickedLocation ? [pickedLocation] : []}
                                onLocationsChange={handleLocationChange}
                                height={350}
                            />
                        </div>
                    )}

                    <div className="m3-form-row">
                        <div className="m3-input-group" style={{ margin: 0 }}>
                            <label className="m3-input-label m3-input-label-required">Locality</label>
                            <input
                                type="text" required
                                value={formData.locality}
                                onChange={e => setFormData({ ...formData, locality: e.target.value })}
                                placeholder="e.g., Indiranagar"
                                className="m3-input"
                            />
                        </div>
                        <div className="m3-input-group" style={{ margin: 0 }}>
                            <label className="m3-input-label">Property Type</label>
                            <select
                                value={formData.propertyType}
                                onChange={e => setFormData({ ...formData, propertyType: e.target.value })}
                                className="m3-input m3-select"
                            >
                                <option value="apartment">Apartment</option>
                                <option value="house">House</option>
                                <option value="villa">Villa</option>
                                <option value="plot">Plot</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* ── Nearby Places — always-visible read-only fields ──────── */}
                <div style={{ marginBottom: 16 }}>
                    <div className="m3-flex m3-gap-xs" style={{ alignItems: 'center', marginBottom: 10 }}>
                        <strong className="md-title-small">Nearby Places</strong>
                        {poiLoading && (
                            <span className="md-body-small m3-text-secondary">— searching OpenStreetMap…</span>
                        )}
                        {!poiLoading && poiError && (
                            <span className="m3-flex m3-gap-xs" style={{ alignItems: 'center' }}>
                                <span className="md-body-small m3-text-error">— {poiError}</span>
                                <button
                                    type="button"
                                    onClick={handleRetryPoi}
                                    disabled={poiLoading}
                                    className="m3-btn m3-btn-error-tonal m3-btn-sm"
                                    style={{ padding: '2px 8px', minHeight: 'unset', fontSize: 11 }}
                                >
                                    {poiLoading ? 'Retrying…' : 'Retry'}
                                </button>
                            </span>
                        )}
                        {!pickedLocation && !poiLoading && (
                            <span className="md-body-small m3-text-secondary">— pin a location on the map above to auto-fill</span>
                        )}
                    </div>

                    <div className="m3-form-row">
                        {POI_ROWS.map(({ key, label, icon }) => {
                            const poi = nearbyPlaces?.[key] as NearbyPlace | undefined;
                            const isReady = !!poi;
                            const isSearching = poiLoading && !poi;

                            return (
                                <div className="m3-input-group" key={key} style={{ margin: '0 0 12px 0', position: 'relative' }}>
                                    <label className="m3-input-label m3-flex m3-gap-xs" style={{ alignItems: 'center' }}>
                                        <span>{icon}</span> {label}
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            readOnly
                                            value={isReady ? `${poi!.name}  (${poi!.distanceKm} km)` : ''}
                                            placeholder={
                                                isSearching ? 'Searching…' :
                                                    !pickedLocation ? 'Auto-filled when map location is picked' :
                                                        (poiError ? 'Temporarily unavailable' : 'Not found nearby')
                                            }
                                            className="m3-input"
                                            style={{
                                                background: isReady ? 'var(--md-sys-color-primary-container)' : undefined,
                                                color: isReady ? 'var(--md-sys-color-on-primary-container)' : undefined,
                                                fontWeight: isReady ? 600 : undefined,
                                                cursor: isReady ? 'pointer' : 'default',
                                                paddingRight: isReady ? 36 : undefined,
                                            }}
                                            onClick={() => isReady && window.open(poi!.osmUrl, '_blank', 'noopener,noreferrer')}
                                            title={isReady ? `Open ${poi!.name} on OpenStreetMap` : undefined}
                                        />
                                        {isSearching && (
                                            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--md-sys-color-outline)' }}>
                                                ⏳
                                            </span>
                                        )}
                                        {isReady && (
                                            <span
                                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--md-sys-color-primary)', cursor: 'pointer', fontWeight: 'bold' }}
                                                onClick={() => window.open(poi!.osmUrl, '_blank', 'noopener,noreferrer')}
                                                title="Open on OpenStreetMap"
                                            >
                                                ↗
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="m3-input-group">
                    <label className="m3-input-label">Address</label>
                    <input
                        type="text"
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Full address"
                        className="m3-input"
                    />
                </div>

                <div className="m3-form-row">
                    <div className="m3-input-group">
                        <label className="m3-input-label m3-input-label-required">Area (sq ft)</label>
                        <input
                            type="number" required min="0"
                            value={formData.area}
                            onChange={e => setFormData({ ...formData, area: parseInt(e.target.value) })}
                            placeholder="e.g., 1200"
                            className="m3-input"
                        />
                    </div>
                    <div className="m3-input-group">
                        <label className="m3-input-label m3-input-label-required">BHK</label>
                        <input
                            type="number" required min="1" max="10"
                            value={formData.bhk}
                            onChange={e => setFormData({ ...formData, bhk: parseInt(e.target.value) })}
                            className="m3-input"
                        />
                    </div>
                </div>

                <div className="m3-input-group">
                    <label className="m3-input-label m3-input-label-required">Price (₹)</label>
                    <input
                        type="number" required min="0"
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        placeholder="e.g., 5000000 (50 lakhs)"
                        className="m3-input"
                    />
                </div>

                <div className="m3-input-group">
                    <label className="m3-input-label">Amenities (comma-separated)</label>
                    <input
                        type="text"
                        value={formData.amenities}
                        onChange={e => setFormData({ ...formData, amenities: e.target.value })}
                        placeholder="e.g., parking, gym, swimming pool, garden"
                        className="m3-input"
                    />
                </div>

                <div className="m3-input-group">
                    <label className="m3-input-label">Contact (phone/name)</label>
                    <input
                        type="text"
                        value={formData.contact}
                        onChange={e => setFormData({ ...formData, contact: e.target.value })}
                        placeholder="e.g., 9876543210 or John Doe"
                        className="m3-input"
                    />
                </div>

                {message && <div className="m3-alert m3-alert-success">{message}</div>}
                {error && <div className="m3-alert m3-alert-error">{error}</div>}

                <div className="m3-flex m3-gap-sm">
                    <button type="submit" className="m3-btn m3-btn-filled" style={{ flex: 1 }} disabled={loading}>
                        {loading
                            ? (isEditing ? 'Updating…' : 'Creating…')
                            : (isEditing ? 'Update Property' : 'Add Property')}
                    </button>
                    {isEditing && (
                        <button
                            type="button"
                            onClick={() => onSuccess && onSuccess()}
                            className="m3-btn m3-btn-tonal"
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

export default PropertyForm;
