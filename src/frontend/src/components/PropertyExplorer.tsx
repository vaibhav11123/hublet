import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MapSearchBar from './MapSearchBar';

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

interface MapProperty {
    id: string;
    title: string;
    locality: string;
    bhk: number;
    price: number;
    area: number;
    propertyType: string;
    lat: number;
    lon: number;
}

function formatPrice(price: number): string {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(1)} L`;
    return `₹${price.toLocaleString('en-IN')}`;
}

const TYPE_COLORS: Record<string, string> = {
    apartment: '#3949AB',
    house: '#4B607C',
    villa: '#E67700',
    plot: '#7C4DFF',
};

export default function PropertyExplorer() {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.LayerGroup | null>(null);
    const [properties, setProperties] = useState<MapProperty[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filters, setFilters] = useState({
        bhk: '',
        minPrice: '',
        maxPrice: '',
        propertyType: '',
    });

    // Initialize map
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        const map = L.map(mapContainerRef.current).setView([20.5937, 78.9629], 5);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        markersRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Fetch properties
    useEffect(() => {
        fetchProperties();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchProperties = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('hublet_auth_token');
            const params = new URLSearchParams();
            if (filters.bhk) params.set('bhk', filters.bhk);
            if (filters.minPrice) params.set('minPrice', filters.minPrice);
            if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
            if (filters.propertyType) params.set('propertyType', filters.propertyType);

            const res = await fetch(`${API_BASE_URL}/properties/map?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('Failed to fetch properties');

            const data: MapProperty[] = await res.json();
            setProperties(data);
            renderMarkers(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load properties');
        } finally {
            setLoading(false);
        }
    };

    const renderMarkers = (props: MapProperty[]) => {
        if (!markersRef.current || !mapRef.current) return;
        markersRef.current.clearLayers();

        const bounds: [number, number][] = [];

        props.forEach((p) => {
            const color = TYPE_COLORS[p.propertyType] || '#7C4DFF';

            const icon = L.divIcon({
                className: '',
                html: `<div style="
          background: ${color};
          width: 28px;
          height: 28px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        "><span style="
          transform: rotate(45deg);
          color: white;
          font-size: 11px;
          font-weight: bold;
        ">${p.bhk}</span></div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 28],
                popupAnchor: [0, -28],
            });

            const marker = L.marker([p.lat, p.lon], { icon }).bindPopup(`
        <div style="min-width: 200px; font-family: Inter, sans-serif;">
          <h4 style="margin: 0 0 6px 0; color: #191C1C;">${p.title}</h4>
          <p style="margin: 2px 0; font-size: 13px; color: #3F4949;">${p.locality}</p>
          <p style="margin: 2px 0; font-size: 13px; color: #3F4949;">${p.bhk} BHK • ${p.area} sqft • ${p.propertyType}</p>
          <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: bold; color: #3949AB;">${formatPrice(p.price)}</p>
        </div>
      `);

            markersRef.current!.addLayer(marker);
            bounds.push([p.lat, p.lon]);
        });

        if (bounds.length > 0 && mapRef.current) {
            mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
        }
    };

    const handleFilter = () => {
        fetchProperties();
    };

    const handleReset = () => {
        setFilters({ bhk: '', minPrice: '', maxPrice: '', propertyType: '' });
        // Fetch with no filters — need a slight delay for state update
        setTimeout(() => fetchProperties(), 100);
    };

    return (
        <div className="m3-flex-col" style={{ height: '80vh', minHeight: 600, borderRadius: 'var(--md-sys-shape-corner-md)', overflow: 'hidden', border: '1px solid var(--md-sys-color-outline-variant)' }}>
            {/* Header */}
            <div className="m3-top-app-bar" style={{ minHeight: 'unset', position: 'relative' }}>
                <div>
                    <h2 className="m3-top-app-bar__title">Property Explorer</h2>
                    <p className="m3-top-app-bar__subtitle">
                        {properties.length} properties on map
                        {loading && ' • Loading...'}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="m3-flex m3-gap-sm m3-flex-wrap" style={{ padding: '12px 24px', background: 'var(--md-sys-color-surface-container-low)', borderBottom: '1px solid var(--md-sys-color-outline-variant)', alignItems: 'center' }}>
                <MapSearchBar map={mapRef.current} placeholder="Search map..." />
                <select
                    value={filters.bhk}
                    onChange={(e) => setFilters({ ...filters, bhk: e.target.value })}
                    className="m3-input m3-select m3-input-compact"
                    style={{ width: 'auto' }}
                >
                    <option value="">Any BHK</option>
                    <option value="1">1 BHK</option>
                    <option value="2">2 BHK</option>
                    <option value="3">3 BHK</option>
                    <option value="4">4+ BHK</option>
                </select>

                <input
                    type="number"
                    placeholder="Min Price (₹)"
                    value={filters.minPrice}
                    onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                    className="m3-input m3-input-compact"
                    style={{ width: 130 }}
                />

                <input
                    type="number"
                    placeholder="Max Price (₹)"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                    className="m3-input m3-input-compact"
                    style={{ width: 130 }}
                />

                <select
                    value={filters.propertyType}
                    onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
                    className="m3-input m3-select m3-input-compact"
                    style={{ width: 'auto' }}
                >
                    <option value="">Any Type</option>
                    <option value="apartment">Apartment</option>
                    <option value="house">House</option>
                    <option value="villa">Villa</option>
                    <option value="plot">Plot</option>
                </select>

                <button onClick={handleFilter} className="m3-btn m3-btn-filled m3-btn-sm">
                    Apply Filters
                </button>

                <button onClick={handleReset} className="m3-btn m3-btn-outlined m3-btn-sm">
                    Reset
                </button>

                {error && (
                    <span className="md-body-small m3-text-error">⚠️ {error}</span>
                )}
            </div>

            {/* Map Legend */}
            <div className="m3-flex m3-gap-md" style={{ padding: '6px 24px', background: 'var(--md-sys-color-surface-container)', borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                {Object.entries(TYPE_COLORS).map(([type, color]) => (
                    <span key={type} className="md-label-small m3-flex m3-gap-xs" style={{ alignItems: 'center', textTransform: 'capitalize' }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color }} />
                        {type}
                    </span>
                ))}
            </div>

            {/* Map container */}
            <div ref={mapContainerRef} style={{ flex: 1 }} />
        </div>
    );
}
