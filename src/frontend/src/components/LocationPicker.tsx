import { useState, useEffect, useRef } from 'react';

// Leaflet CSS is imported in App.tsx or index.html
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export interface PickedLocation {
    name: string;
    lat: number;
    lon: number;
    address?: string;
}

interface LocationPickerProps {
    /** Whether this is for picking multiple localities (buyer) or a single point (seller) */
    mode: 'single' | 'multiple';
    /** Already-picked locations to display on mount */
    initialLocations?: PickedLocation[];
    /** Callback when locations change */
    onLocationsChange: (locations: PickedLocation[]) => void;
    /** Map height in px */
    height?: number;
}

export default function LocationPicker({
    mode,
    initialLocations = [],
    onLocationsChange,
    height = 400,
}: LocationPickerProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const [locations, setLocations] = useState<PickedLocation[]>(initialLocations);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current).setView([20.5937, 78.9629], 5); // Center on India

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        // Click handler for picking locations
        map.on('click', async (e: L.LeafletMouseEvent) => {
            const { lat, lng: lon } = e.latlng;
            await reverseGeocodeAndAdd(lat, lon, map);
        });

        mapRef.current = map;

        // Add initial markers
        initialLocations.forEach((loc) => {
            addMarker(loc, map);
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const reverseGeocodeAndAdd = async (lat: number, lon: number, map: L.Map) => {
        setLoading(true);
        try {
            // Use our backend reverse-geocode endpoint
            const token = localStorage.getItem('hublet_auth_token');
            const res = await fetch(
                `${API_BASE_URL}/properties/reverse-geocode?lat=${lat}&lon=${lon}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!res.ok) throw new Error('Reverse geocode failed');

            const data = await res.json();
            const newLoc: PickedLocation = {
                name: data.locality || 'Unknown',
                lat: data.lat,
                lon: data.lon,
                address: data.displayName || data.address,
            };
            handleAddLocation(newLoc, map);
        } catch (err) {
            console.error('Reverse geocode error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddLocation = (newLoc: PickedLocation, map: L.Map) => {
        if (mode === 'single') {
            // Replace existing
            markersRef.current.forEach((m) => m.remove());
            markersRef.current = [];
            const updated = [newLoc];
            setLocations(updated);
            onLocationsChange(updated);
            addMarker(newLoc, map);
        } else {
            // Add to list (avoid duplicates by name)
            setLocations((prev) => {
                const exists = prev.some(
                    (l) => l.name.toLowerCase() === newLoc.name.toLowerCase()
                );
                if (exists) return prev;
                const updated = [...prev, newLoc];
                onLocationsChange(updated);
                return updated;
            });
            addMarker(newLoc, map);
        }
    };

    const addMarker = (loc: PickedLocation, map: L.Map) => {
        const marker = L.marker([loc.lat, loc.lon])
            .addTo(map)
            .bindPopup(
                `<strong>${loc.name}</strong><br/><small>${loc.address || ''}</small><br/><em>Click marker to remove</em>`
            );

        marker.on('click', () => {
            marker.remove();
            markersRef.current = markersRef.current.filter((m) => m !== marker);
            setLocations((prev) => {
                const updated = prev.filter(
                    (l) => !(Math.abs(l.lat - loc.lat) < 0.0001 && Math.abs(l.lon - loc.lon) < 0.0001)
                );
                onLocationsChange(updated);
                return updated;
            });
        });

        markersRef.current.push(marker);
    };

    const handleRemoveLocation = (index: number) => {
        const loc = locations[index];
        // Remove the corresponding marker
        const markerToRemove = markersRef.current.find((m) => {
            const pos = m.getLatLng();
            return Math.abs(pos.lat - loc.lat) < 0.0001 && Math.abs(pos.lng - loc.lon) < 0.0001;
        });
        if (markerToRemove) {
            markerToRemove.remove();
            markersRef.current = markersRef.current.filter((m) => m !== markerToRemove);
        }
        setLocations((prev) => {
            const updated = prev.filter((_, i) => i !== index);
            onLocationsChange(updated);
            return updated;
        });
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const token = localStorage.getItem('hublet_auth_token');
            const res = await fetch(
                `${API_BASE_URL}/properties/geocode?query=${encodeURIComponent(searchQuery)}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!res.ok) throw new Error('Search failed');
            const r = await res.json();
            const newLoc: PickedLocation = {
                name: r.locality || searchQuery,
                lat: r.lat,
                lon: r.lon,
                address: r.displayName || r.address,
            };
            if (mapRef.current) {
                mapRef.current.setView([newLoc.lat, newLoc.lon], 14);
                handleAddLocation(newLoc, mapRef.current);
            }
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoading(false);
            setSearchQuery('');
        }
    };

    return (
        <div className="m3-map-container" style={{ borderRadius: 'var(--md-sys-shape-corner-sm)' }}>
            {/* Search bar */}
            <div className="m3-flex m3-gap-xs" style={{ padding: 10, background: 'var(--md-sys-color-surface-container)', borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search for a location..."
                    className="m3-input m3-input-compact"
                    style={{ flex: 1 }}
                />
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="m3-btn m3-btn-filled m3-btn-sm"
                >
                    {loading ? '...' : '🔍 Search'}
                </button>
            </div>

            {/* Map */}
            <div ref={mapContainerRef} style={{ height: `${height}px`, width: '100%' }} />

            {/* Selected locations */}
            {locations.length > 0 && (
                <div style={{ padding: 10, background: 'var(--md-sys-color-surface-container)', borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                    <small className="md-label-medium m3-text-secondary">
                        {mode === 'single' ? 'Selected Location:' : `Selected Localities (${locations.length}):`}
                    </small>
                    <div className="m3-flex m3-flex-wrap m3-gap-xs" style={{ marginTop: 6 }}>
                        {locations.map((loc, i) => (
                            <span
                                key={i}
                                className="m3-chip m3-chip-primary"
                            >
                                📍 {loc.name}
                                <button
                                    onClick={() => handleRemoveLocation(i)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--md-sys-color-error)',
                                        cursor: 'pointer',
                                        fontSize: 14,
                                        padding: '0 2px',
                                        lineHeight: 1,
                                    }}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {loading && (
                <div className="m3-alert m3-alert-warning" style={{ margin: 0, borderRadius: 0 }}>
                    📡 Resolving location...
                </div>
            )}

            <div style={{ padding: '6px 10px', background: 'var(--md-sys-color-surface-container)', fontSize: 11, color: 'var(--md-sys-color-outline)', textAlign: 'center' }}>
                {mode === 'single'
                    ? 'Click on the map to select property location, or search above'
                    : 'Click on the map to add localities, or search above. Click a marker to remove.'}
            </div>
        </div>
    );
}
