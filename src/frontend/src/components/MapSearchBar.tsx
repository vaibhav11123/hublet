import { useState, useRef, useEffect } from 'react';
import L from 'leaflet';

interface MapSearchBarProps {
    map: L.Map | null;
    placeholder?: string;
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

interface SearchResult {
    display_name: string;
    lat: string;
    lon: string;
}

export default function MapSearchBar({ map, placeholder = 'Search location...' }: MapSearchBarProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const search = async (q: string) => {
        if (q.length < 2) { setResults([]); return; }
        setSearching(true);
        try {
            const res = await fetch(
                `${NOMINATIM_BASE}/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=in`,
                { headers: { 'User-Agent': 'Hublet-RealEstate/1.0' } }
            );
            const data: SearchResult[] = await res.json();
            setResults(data);
            setShowDropdown(data.length > 0);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleInputChange = (value: string) => {
        setQuery(value);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => search(value), 400);
    };

    const handleSelect = (r: SearchResult) => {
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);
        if (map) {
            map.setView([lat, lon], 13);
        }
        setQuery(r.display_name.split(',').slice(0, 2).join(','));
        setShowDropdown(false);
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', zIndex: 1000 }}>
            <input
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
                placeholder={placeholder}
                className="m3-input m3-input-compact"
                style={{ width: 260 }}
            />
            {searching && (
                <span style={{ position: 'absolute', right: 10, top: 9, fontSize: 12, color: 'var(--md-sys-color-outline)' }}>...</span>
            )}
            {showDropdown && results.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--md-sys-color-surface-container-lowest)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    borderRadius: '0 0 var(--md-sys-shape-corner-sm) var(--md-sys-shape-corner-sm)',
                    boxShadow: 'var(--md-sys-elevation-3)',
                    maxHeight: 200,
                    overflowY: 'auto',
                }}>
                    {results.map((r, i) => (
                        <div
                            key={i}
                            onClick={() => handleSelect(r)}
                            className="md-body-small"
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: i < results.length - 1 ? '1px solid var(--md-sys-color-outline-variant)' : 'none',
                                color: 'var(--md-sys-color-on-surface)',
                                transition: 'background var(--md-sys-motion-duration-short1) var(--md-sys-motion-easing-standard)',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--md-sys-color-surface-container)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            {r.display_name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
