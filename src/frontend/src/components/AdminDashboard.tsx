import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
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

interface Buyer { id: string; name: string; email: string; phone?: string; localities: string[]; bhk?: number; budgetMin?: number; budgetMax?: number; areaMin?: number; areaMax?: number; amenities: string[]; metadata?: any; createdAt: string; }
interface Seller { id: string; name: string; email: string; phone?: string; sellerType: string; rating: number; ratingCount: number; completedDeals: number; trustScore: number; metadata?: any; createdAt: string; properties?: any[]; propertyCount?: number; _count?: { properties?: number }; }
interface Property { id: string; title: string; description?: string; locality: string; address?: string; area: number; bhk: number; price: number; amenities: string[]; propertyType: string; contact?: string; isActive: boolean; metadata?: any; createdAt: string; seller: Seller; }
interface Lead { id: string; state: string; matchScore?: number; createdAt: string; updatedAt: string; buyer: { name: string; email: string; phone?: string }; property: { title: string; locality: string; price?: number; bhk?: number; area?: number; seller?: { name: string; email?: string; sellerType?: string } }; }
interface Match { id: string; matchScore: number; locationScore?: number; budgetScore?: number; sizeScore?: number; amenitiesScore?: number; createdAt: string; buyer: { name: string; email: string }; property: { title: string; locality: string; seller?: { name: string; email?: string; sellerType?: string } }; }
interface WorkflowEvent { id: string; eventType: string; fromState?: string; toState?: string; description?: string; createdAt: string; }
interface FbScrapedRow { TITLE: string; LOCALITY: string; TYPE: string; BHK: string; AREA: string; PRICE: string; AMENITIES: string; SELLER: string; STATUS: string; CREATED_AT: string; CONTACT: string; GROUP_URL: string; }

type TabType = 'buyers' | 'sellers' | 'properties' | 'leads' | 'matches' | 'logs' | 'fb-scrape' | 'manual-scrape' | 'property-map' | 'buyer-map' | 'settings-profile' | 'settings-theme';

const TAB_ICONS: Record<TabType, string> = {
    buyers: '⊕', sellers: '⊗', properties: '⌂', leads: '⇌',
    matches: '⊞', logs: '≡', 'property-map': '◎', 'buyer-map': '◉',
    'manual-scrape': '⚙', 'fb-scrape': 'ƒ', 'settings-profile': '○', 'settings-theme': '◐',
};

const TAB_LABELS: Record<TabType, string> = {
    buyers: 'Buyers', sellers: 'Sellers', properties: 'Properties', leads: 'Leads',
    matches: 'Matches', logs: 'Event Logs', 'property-map': 'Property Map', 'buyer-map': 'Buyer Map',
    'manual-scrape': 'Manual Scrape', 'fb-scrape': 'FB Scrape',
    'settings-profile': 'Profile', 'settings-theme': 'Theme',
};

interface SidebarCategory { label: string; icon: string; tabs: TabType[]; }

const SIDEBAR_CATEGORIES: SidebarCategory[] = [
    { label: 'Data', icon: '', tabs: ['buyers', 'sellers', 'properties', 'leads', 'matches'] },
    { label: 'Scrapers', icon: '', tabs: ['manual-scrape', 'fb-scrape'] },
    { label: 'Maps', icon: '', tabs: ['property-map', 'buyer-map'] },
    { label: 'Logs', icon: '', tabs: ['logs'] },
    { label: 'Settings', icon: '', tabs: ['settings-profile', 'settings-theme'] },
];

interface SavedFbLink { label: string; url: string; }

const SAVED_FB_LINKS_KEY = 'hublet_saved_fb_links';
const THEME_KEY = 'hublet_theme';

const loadSavedFbLinks = (): SavedFbLink[] => {
    try { return JSON.parse(localStorage.getItem(SAVED_FB_LINKS_KEY) || '[]'); } catch { return []; }
};
const persistFbLinks = (links: SavedFbLink[]) => localStorage.setItem(SAVED_FB_LINKS_KEY, JSON.stringify(links));

const loadTheme = (): 'light' | 'dark' => {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark' || t === 'light') return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getScoreClass = (score: number | undefined | null): string => {
    if (score == null) return '';
    if (score > 70) return 'm3-score-high';
    if (score >= 30) return 'm3-score-mid';
    return 'm3-score-low';
};

const getSellerRoleChipClass = (role?: string): string => {
    switch (role?.toLowerCase()) {
        case 'owner': return 'm3-chip m3-chip-role-owner';
        case 'agent': return 'm3-chip m3-chip-role-agent';
        case 'builder': return 'm3-chip m3-chip-role-builder';
        default: return 'm3-chip m3-chip-role-individual';
    }
};

export const AdminDashboard = ({
    userEmail,
    onLogout,
    onViewAnalytics,
}: {
    userEmail: string;
    onLogout: () => void;
    onViewAnalytics?: () => void;
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('buyers');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>(loadTheme);
    const [savedFbLinks, setSavedFbLinks] = useState<SavedFbLink[]>(loadSavedFbLinks);
    const [buyers, setBuyers] = useState<Buyer[]>([]);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [properties, setProperties] = useState<Property[]>([]);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [logs, setLogs] = useState<WorkflowEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [manualCity, setManualCity] = useState('');
    const [manualScraper, setManualScraper] = useState('');
    const [manualScraping, setManualScraping] = useState(false);
    const [manualScrapeMessage, setManualScrapeMessage] = useState<string | null>(null);
    const [availableScrapers, setAvailableScrapers] = useState<string[]>([]);

    const [fbGroupUrl, setFbGroupUrl] = useState('');
    const [fbPostLimit, setFbPostLimit] = useState(10);
    const [fbResults, setFbResults] = useState<FbScrapedRow[]>([]);
    const [fbScraping, setFbScraping] = useState(false);
    const [fbSaving, setFbSaving] = useState(false);
    const [fbMessage, setFbMessage] = useState<string | null>(null);
    const [fbError, setFbError] = useState<string | null>(null);

    const [seedingBuyers, setSeedingBuyers] = useState(false);
    const [refreshingMatches, setRefreshingMatches] = useState(false);
    const [deletingBuyers, setDeletingBuyers] = useState(false);
    const [deletingSellers, setDeletingSellers] = useState(false);
    const [seedingSellers, setSeedingSellers] = useState(false);
    const [resettingSellers, setResettingSellers] = useState(false);
    const [credentials, setCredentials] = useState<any[] | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);

    const propertyMapRef = useRef<HTMLDivElement>(null);
    const propertyMapInstance = useRef<L.Map | null>(null);
    const buyerMapRef = useRef<HTMLDivElement>(null);
    const buyerMapInstance = useRef<L.Map | null>(null);

    // Theme effect
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
    }, [theme]);

    // Saved FB links helpers
    const addFbLink = (url: string, label: string) => {
        const next = [...savedFbLinks, { url, label }];
        setSavedFbLinks(next); persistFbLinks(next);
    };
    const removeFbLink = (idx: number) => {
        const next = savedFbLinks.filter((_, i) => i !== idx);
        setSavedFbLinks(next); persistFbLinks(next);
    };

    // Sidebar tab switch
    const handleTabSwitch = (tab: TabType) => {
        setActiveTab(tab);
        setMobileOpen(false);
    };

    useEffect(() => { fetchData(); if (activeTab === 'manual-scrape') fetchScrapers(); }, [activeTab]);

    const fetchScrapers = async () => { try { const res = await axios.get(`${API_BASE_URL}/admin/scrapers`); if (res.data.success && Array.isArray(res.data.scrapers)) setAvailableScrapers(res.data.scrapers.map((s: any) => s.name || s)); } catch (e: any) { setError(e.message); } };

    const fetchData = async () => {
        setLoading(true); setError(null);
        try {
            switch (activeTab) {
                case 'buyers': setBuyers((await axios.get(`${API_BASE_URL}/buyers`)).data); break;
                case 'sellers': setSellers((await axios.get(`${API_BASE_URL}/sellers`)).data); break;
                case 'properties': setProperties((await axios.get(`${API_BASE_URL}/properties`)).data); break;
                case 'leads': setLeads((await axios.get(`${API_BASE_URL}/leads`)).data); break;
                case 'matches': setMatches((await axios.get(`${API_BASE_URL}/matches`)).data); break;
                case 'logs': setLogs((await axios.get(`${API_BASE_URL}/workflow-events`)).data); break;
            }
        } catch (err: any) { setError(err.message || 'Failed to fetch data'); }
        finally { setLoading(false); }
    };

    const fmt = (d: string) => new Date(d).toLocaleString();
    const fmtPrice = (p: number) => { if (p >= 10000000) return `₹${(p / 10000000).toFixed(2)} Cr`; if (p >= 100000) return `₹${(p / 100000).toFixed(1)} Lac`; return `₹${p.toLocaleString('en-IN')}`; };

    const handleOverrideRating = async (sellerId: string, newRating: number) => {
        try { await axios.post(`${API_BASE_URL}/sellers/${sellerId}/rate`, { rating: newRating }); alert('Rating submitted successfully!'); fetchData(); }
        catch (error: any) { alert('Failed to submit rating. ' + (error?.response?.data?.error || '')); }
    };

    const getScoreColor = (s: number) => s >= 70 ? 'var(--md-sys-color-success)' : s >= 40 ? 'var(--md-sys-color-warning)' : 'var(--md-sys-color-error)';

    const getEventChipClass = (t: string) => {
        if (t === 'ERROR' || t === 'INVALID_TRANSITION') return 'm3-chip-error';
        if (t === 'STATE_TRANSITION') return 'm3-chip-primary';
        if (t === 'MATCH_GENERATED') return 'm3-chip-success';
        return 'm3-chip-warning';
    };

    const getStateChipClass = (s: string) => {
        if (s === 'CLOSED') return 'm3-chip-success';
        if (s === 'NEW') return 'm3-chip-primary';
        if (s === 'CONTACTED') return 'm3-chip-warning';
        return 'm3-chip-filled';
    };

    return (
        <div className="m3-dashboard-layout">
            {/* Mobile top bar */}
            <div className="m3-dashboard-mobile-bar">
                <button className="m3-sidebar__toggle" onClick={() => setMobileOpen(true)}>☰</button>
                <span className="md-title-medium" style={{ color: 'var(--md-sys-color-primary)' }}>Hublet</span>
            </div>

            {/* Sidebar scrim (mobile) */}
            {mobileOpen && <div className="m3-sidebar-scrim" onClick={() => setMobileOpen(false)} />}

            {/* Left sidebar */}
            <aside className={`m3-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'open-mobile' : ''}`}>
                <div className="m3-sidebar__header">
                    <div className="m3-sidebar__brand">
                        <span className="m3-sidebar__brand-icon">H</span>
                        <span className="m3-sidebar__brand-text">Hublet</span>
                    </div>
                    <button className="m3-sidebar__toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                        {sidebarCollapsed ? '→' : '←'}
                    </button>
                </div>
                <nav className="m3-sidebar__nav">
                    {SIDEBAR_CATEGORIES.map(cat => (
                        <div key={cat.label} className="m3-sidebar__group">
                            <div className="m3-sidebar__group-label">{cat.label}</div>
                            {cat.tabs.map(tab => (
                                <button
                                    key={tab}
                                    className={`m3-sidebar__item ${activeTab === tab ? 'active' : ''}`}
                                    onClick={() => handleTabSwitch(tab)}
                                >
                                    <span className="m3-sidebar__item-icon">{TAB_ICONS[tab]}</span>
                                    <span className="m3-sidebar__item-label">{TAB_LABELS[tab]}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="m3-sidebar__footer">
                    <div className="m3-sidebar__user">
                        <div className="m3-sidebar__user-avatar">{userEmail.charAt(0).toUpperCase()}</div>
                        <div className="m3-sidebar__user-info">
                            <div className="md-label-medium" style={{ color: 'var(--md-sys-color-on-surface)' }}>{userEmail}</div>
                            <div className="md-body-small m3-text-secondary">Admin</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="m3-dashboard-main">
                <div className="m3-container">
                    {loading && <p className="m3-loading">Loading...</p>}
                    {error && <div className="m3-alert m3-alert-error">Error: {error}</div>}

                    {/* Admin Tools (always visible except settings tabs) */}
                    {!activeTab.startsWith('settings-') && (
                        <div className="m3-surface-container m3-flex m3-gap-sm m3-flex-wrap" style={{ alignItems: 'center', marginBottom: 20 }}>
                            <span className="md-label-large m3-text-primary" style={{ marginRight: 8 }}>Admin Tools:</span>
                            {onViewAnalytics ? (
                                <button
                                    onClick={onViewAnalytics}
                                    className="m3-btn m3-btn-filled m3-btn-sm"
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    View Analytics
                                </button>
                            ) : null}
                            {activeTab === 'sellers' && (
                                <>
                                    <button
                                        onClick={async () => {
                                            if (!window.confirm('Reset ALL seller trust scores, ratings, and deals to 0?\n\nThis cannot be undone.')) return;
                                            setResettingSellers(true); setActionMessage(null);
                                            try { const res = await axios.post(`${API_BASE_URL}/admin/seed/reset-seller-trust`); setActionMessage(res.data.success ? `[OK] ${res.data.message}` : `[ERR] ${res.data.error || 'Failed'}`); fetchData(); }
                                            catch (err: any) { setActionMessage(`[ERR] ${err.response?.data?.error || err.message}`); }
                                            finally { setResettingSellers(false); }
                                        }}
                                        disabled={resettingSellers}
                                        className="m3-btn m3-btn-error m3-btn-sm"
                                    >{resettingSellers ? 'Resetting...' : 'Reset Seller Trust to 0'}</button>
                                    <button
                                        onClick={async () => {
                                            if (credentials) { setCredentials(null); return; }
                                            try { const res = await axios.get(`${API_BASE_URL}/admin/seed/credentials`); setCredentials(res.data.credentials || []); }
                                            catch (err: any) { alert('Failed to fetch credentials: ' + (err.response?.data?.error || err.message)); }
                                        }}
                                        className="m3-btn m3-btn-tonal m3-btn-sm"
                                    >{credentials ? 'Hide Credentials' : 'View Credentials'}</button>
                                </>
                            )}
                        </div>
                    )}

                    {actionMessage && (
                        <div className={`m3-alert ${actionMessage.includes('[OK]') ? 'm3-alert-success' : 'm3-alert-error'}`}>
                            {actionMessage}
                        </div>
                    )}

                    {/* Credentials — fixed white-on-white */}
                    {credentials && (
                        <div className="m3-credential-card">
                            <h3 className="md-title-medium" style={{ color: 'var(--md-sys-color-inverse-primary)', marginBottom: 12 }}>Stored Credentials ({credentials.length})</h3>
                            <div className="m3-table-container">
                                <table className="m3-table" style={{ fontSize: 13 }}>
                                    <thead><tr>
                                        <th>Role</th><th>Name</th><th>Email</th><th>Password</th><th>Source</th><th>Timestamp</th>
                                    </tr></thead>
                                    <tbody>{credentials.map((c: any, i: number) => (
                                        <tr key={i}>
                                            <td><span className={`m3-chip ${c.role === 'admin' ? 'm3-chip-error' : c.role === 'buyer' ? 'm3-chip-success' : 'm3-chip-warning'}`} style={{ textTransform: 'uppercase', fontSize: 11 }}>{c.role}</span></td>
                                            <td>{c.name}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{c.email}</td>
                                            <td style={{ fontFamily: 'monospace' }}>{c.password}</td>
                                            <td className="md-body-small">{c.source}</td>
                                            <td className="md-body-small">{c.timestamp ? new Date(c.timestamp).toLocaleString() : '--'}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════ TAB CONTENT ═══════════════════ */}
                    <div className="m3-fade-in" key={activeTab}>

                        {/* ── BUYERS ────────────────────────── */}
                        {activeTab === 'buyers' && (
                            <div>
                                <div className="m3-flex-between m3-flex-wrap m3-gap-sm" style={{ marginBottom: 16 }}>
                                    <h2 className="md-title-large">All Buyers ({buyers.length})</h2>
                                    <div className="m3-flex m3-gap-xs">
                                        <button onClick={async () => { if (!window.confirm('Seed demo buyers?')) return; setSeedingBuyers(true); setActionMessage(null); try { const res = await axios.post(`${API_BASE_URL}/admin/seed/demo-buyers`); setActionMessage(res.data.success ? `[OK] ${res.data.message}` : `[ERR] ${res.data.error}`); fetchData(); } catch (err: any) { setActionMessage(`[ERR] ${err.response?.data?.error || err.message}`); } finally { setSeedingBuyers(false); } }} disabled={seedingBuyers} className="m3-btn m3-btn-tonal m3-btn-sm">{seedingBuyers ? 'Seeding...' : 'Seed Demo Buyers'}</button>
                                        <button onClick={async () => { if (!window.confirm('Delete ALL buyers?')) return; setDeletingBuyers(true); setActionMessage(null); try { const res = await axios.post(`${API_BASE_URL}/admin/seed/delete-all-buyers`); setActionMessage(res.data.success ? `[OK] ${res.data.message}` : `[ERR] ${res.data.error}`); fetchData(); } catch (err: any) { setActionMessage(`[ERR] ${err.response?.data?.error || err.message}`); } finally { setDeletingBuyers(false); } }} disabled={deletingBuyers} className="m3-btn m3-btn-error m3-btn-sm">{deletingBuyers ? 'Deleting...' : 'Delete All Buyers'}</button>
                                    </div>
                                </div>
                                <div className="m3-table-container">
                                    <table className="m3-table">
                                        <thead><tr>
                                            <th>Name</th><th>Email</th><th>Phone</th><th>Localities</th><th>BHK</th><th>Budget</th><th>Area</th><th>Amenities</th><th>Joined</th><th>Actions</th>
                                        </tr></thead>
                                        <tbody>{buyers.map(b => (
                                            <tr key={b.id}>
                                                <td style={{ fontWeight: 500 }}>{b.name}{b.metadata?.coordinates?.lat && <div style={{ marginTop: 4 }}><a href={`https://www.openstreetmap.org/?mlat=${b.metadata.coordinates.lat}&mlon=${b.metadata.coordinates.lon}#map=16/${b.metadata.coordinates.lat}/${b.metadata.coordinates.lon}`} target="_blank" rel="noopener noreferrer" className="m3-text-primary md-body-small">Map</a></div>}</td>
                                                <td className="md-body-small">{b.email}</td>
                                                <td>{b.phone || 'N/A'}</td>
                                                <td style={{ maxWidth: 200 }}>{Array.isArray(b.localities) ? b.localities.join(', ') : (b.localities || 'N/A')}</td>
                                                <td>{b.bhk ? `${b.bhk} BHK` : 'N/A'}</td>
                                                <td style={{ fontWeight: 600 }} className="m3-text-success">{b.budgetMin || b.budgetMax ? `${fmtPrice(b.budgetMin || 0)} – ${fmtPrice(b.budgetMax || 0)}` : 'N/A'}</td>
                                                <td>{b.areaMin || b.areaMax ? `${b.areaMin || '?'} – ${b.areaMax || '?'} sqft` : 'N/A'}</td>
                                                <td className="md-body-small">{Array.isArray(b.amenities) && b.amenities.length > 0 ? b.amenities.join(', ') : 'None'}</td>
                                                <td className="md-body-small">{fmt(b.createdAt)}</td>
                                                <td><button onClick={async () => { try { await axios.delete(`${API_BASE_URL}/buyers/${b.id}`); fetchData(); } catch { alert('Failed to delete buyer'); } }} className="m3-btn m3-btn-error m3-btn-sm">Remove</button></td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── SELLERS ──────────────────────── */}
                        {activeTab === 'sellers' && (
                            <div>
                                <div className="m3-flex-between m3-flex-wrap m3-gap-sm" style={{ marginBottom: 16 }}>
                                    <h2 className="md-title-large">All Sellers ({sellers.length})</h2>
                                    <div className="m3-flex m3-gap-xs">
                                        <button onClick={async () => { if (!window.confirm('Seed demo sellers?')) return; setSeedingSellers(true); setActionMessage(null); try { const res = await axios.post(`${API_BASE_URL}/admin/seed/demo-sellers`); setActionMessage(res.data.success ? `[OK] ${res.data.message}` : `[ERR] ${res.data.error}`); fetchData(); } catch (err: any) { setActionMessage(`[ERR] ${err.response?.data?.error || err.message}`); } finally { setSeedingSellers(false); } }} disabled={seedingSellers} className="m3-btn m3-btn-tonal m3-btn-sm">{seedingSellers ? 'Seeding...' : 'Seed Demo Sellers'}</button>
                                        <button onClick={async () => { if (!window.confirm('Delete ALL sellers?')) return; setDeletingSellers(true); setActionMessage(null); try { const res = await axios.post(`${API_BASE_URL}/admin/seed/delete-all-sellers`); setActionMessage(res.data.success ? `[OK] ${res.data.message}` : `[ERR] ${res.data.error}`); fetchData(); } catch (err: any) { setActionMessage(`[ERR] ${err.response?.data?.error || err.message}`); } finally { setDeletingSellers(false); } }} disabled={deletingSellers} className="m3-btn m3-btn-error m3-btn-sm">{deletingSellers ? 'Deleting...' : 'Delete All Sellers'}</button>
                                    </div>
                                </div>
                                <div className="m3-table-container">
                                    <table className="m3-table">
                                        <thead><tr>
                                            <th>Name</th><th>Email</th><th>Phone</th><th>Type</th><th>Properties</th><th>Rating</th><th>Deals</th><th>Trust</th><th>Joined</th><th>Actions</th>
                                        </tr></thead>
                                        <tbody>{sellers.map((s: any) => (
                                            <tr key={s.id}>
                                                <td style={{ fontWeight: 500 }}>{s.name}{(() => { const c = s.properties?.[0]?.metadata?.coordinates; const city = s.metadata?.city; const href = c ? `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=14/${c.lat}/${c.lon}` : city ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(city + ', India')}` : null; return href ? <div style={{ marginTop: 4 }}><a href={href} target="_blank" rel="noopener noreferrer" className="m3-text-primary md-body-small">Map</a></div> : null; })()}</td>
                                                <td className="md-body-small">{s.email}</td>
                                                <td>{s.phone || 'N/A'}</td>
                                                <td><span className={`m3-chip ${s.sellerType === 'owner' ? 'm3-chip-primary' : s.sellerType === 'builder' ? 'm3-chip-filled' : 'm3-chip-warning'}`} style={{ textTransform: 'capitalize' }}>{s.sellerType}</span></td>
                                                <td><strong>{s.propertyCount || s._count?.properties || 0}</strong>{s.properties?.length > 0 && <div className="md-body-small m3-text-secondary" style={{ marginTop: 4 }}>{s.properties.slice(0, 2).map((p: any) => <div key={p.id}>{p.title?.substring(0, 30)}{p.title?.length > 30 ? '...' : ''}</div>)}{s.properties.length > 2 && <div>+{s.properties.length - 2} more</div>}</div>}</td>
                                                <td>{s.ratingCount === 0 ? "Not rated" : <><span style={{ fontWeight: 600 }}>{s.rating.toFixed(1)}</span> <span className="md-body-small m3-text-secondary">({s.ratingCount})</span></>}</td>
                                                <td>{s.completedDeals}</td>
                                                <td><span className={`m3-badge ${s.trustScore >= 70 ? 'm3-badge-success' : s.trustScore >= 40 ? 'm3-badge-warning' : 'm3-badge-error'}`}>{s.trustScore}</span></td>
                                                <td className="md-body-small">{fmt(s.createdAt)}</td>
                                                <td>
                                                    <div className="m3-flex m3-gap-xs" style={{ alignItems: 'center' }}>
                                                        <select onChange={(e) => { if (e.target.value) { handleOverrideRating(s.id, Number(e.target.value)); e.target.value = ""; } }} defaultValue="" className="m3-input m3-select m3-input-compact" style={{ width: 90 }}>
                                                            <option value="" disabled>Rate</option>
                                                            <option value="1">1★</option><option value="2">2★</option><option value="3">3★</option><option value="4">4★</option><option value="5">5★</option>
                                                        </select>
                                                        <button onClick={async () => { if (window.confirm(`Delete seller "${s.name}"?`)) { try { await axios.delete(`${API_BASE_URL}/sellers/${s.id}`); fetchData(); } catch { alert('Failed'); } } }} className="m3-btn m3-btn-error m3-btn-sm">Remove</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── PROPERTIES ───────────────────── */}
                        {activeTab === 'properties' && (
                            <div>
                                <h2 className="md-title-large" style={{ marginBottom: 16 }}>All Properties ({properties.length})</h2>
                                <div className="m3-table-container">
                                    <table className="m3-table">
                                        <thead><tr>
                                            <th>Img</th><th>Map</th><th>Title</th><th>Locality</th><th>Type</th><th>BHK</th><th>Area</th><th>Price</th><th>Seller</th><th>Contact</th><th>Source</th><th>Posted</th><th>Status</th><th>Actions</th>
                                        </tr></thead>
                                        <tbody>{properties.map(p => (
                                            <tr key={p.id}>
                                                <td style={{ width: 50, padding: 6 }}>{p.metadata?.imageUrl ? <img src={p.metadata.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--md-sys-shape-corner-xs)' }} /> : <div style={{ width: 48, height: 48, background: 'var(--md-sys-color-surface-container)', borderRadius: 'var(--md-sys-shape-corner-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🏠</div>}</td>
                                                <td style={{ width: 36 }}>{p.metadata?.coordinates?.lat ? <a href={`https://www.openstreetmap.org/?mlat=${p.metadata.coordinates.lat}&mlon=${p.metadata.coordinates.lon}#map=16/${p.metadata.coordinates.lat}/${p.metadata.coordinates.lon}`} target="_blank" rel="noopener noreferrer" className="m3-text-primary md-body-small" style={{ fontWeight: 600 }}>Map</a> : <span className="m3-text-secondary">—</span>}</td>
                                                <td style={{ maxWidth: 250 }}>
                                                    <strong>{p.title}</strong>
                                                    {p.description && <div className="md-body-small m3-text-secondary" style={{ marginTop: 4, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>}
                                                    {p.metadata?.sourceUrl && <a href={p.metadata.sourceUrl} target="_blank" rel="noopener noreferrer" className="m3-text-primary md-body-small">View listing ↗</a>}
                                                    {p.metadata?.groupUrl && <a href={p.metadata.groupUrl} target="_blank" rel="noopener noreferrer" className="md-body-small" style={{ color: 'var(--md-sys-color-tertiary)', marginLeft: p.metadata?.sourceUrl ? 8 : 0, display: 'inline-block' }}>View Group ↗</a>}
                                                </td>
                                                <td>
                                                    {p.locality}
                                                    {p.metadata?.landmark && <div className="md-body-small m3-text-secondary">📍 {p.metadata.landmark}</div>}
                                                    {p.metadata?.nearbyPlaces && (
                                                        <div className="md-body-small m3-text-secondary" style={{ marginTop: 5, lineHeight: 1.7 }}>
                                                            {p.metadata.nearbyPlaces.airport && <div><strong>Airport:</strong> <a href={p.metadata.nearbyPlaces.airport.osmUrl} target="_blank" rel="noopener noreferrer" className="m3-text-primary">{p.metadata.nearbyPlaces.airport.name}</a> <span className="m3-text-secondary">({p.metadata.nearbyPlaces.airport.distanceKm} km)</span></div>}
                                                            {p.metadata.nearbyPlaces.busStation && <div><strong>Bus:</strong> <a href={p.metadata.nearbyPlaces.busStation.osmUrl} target="_blank" rel="noopener noreferrer" className="m3-text-primary">{p.metadata.nearbyPlaces.busStation.name}</a> <span className="m3-text-secondary">({p.metadata.nearbyPlaces.busStation.distanceKm} km)</span></div>}
                                                            {p.metadata.nearbyPlaces.trainStation && <div><strong>Train:</strong> <a href={p.metadata.nearbyPlaces.trainStation.osmUrl} target="_blank" rel="noopener noreferrer" className="m3-text-primary">{p.metadata.nearbyPlaces.trainStation.name}</a> <span className="m3-text-secondary">({p.metadata.nearbyPlaces.trainStation.distanceKm} km)</span></div>}
                                                            {p.metadata.nearbyPlaces.hospital && <div><strong>Hospital:</strong> <a href={p.metadata.nearbyPlaces.hospital.osmUrl} target="_blank" rel="noopener noreferrer" className="m3-text-primary">{p.metadata.nearbyPlaces.hospital.name}</a> <span className="m3-text-secondary">({p.metadata.nearbyPlaces.hospital.distanceKm} km)</span></div>}
                                                        </div>
                                                    )}
                                                </td>
                                                <td><span className="m3-chip m3-chip-primary" style={{ textTransform: 'capitalize' }}>{p.propertyType}</span></td>
                                                <td>{p.bhk || '—'}</td>
                                                <td>{p.area ? `${p.area} sqft` : '—'}</td>
                                                <td style={{ fontWeight: 600 }} className="m3-text-success">{fmtPrice(p.price)}</td>
                                                <td><strong>{p.seller?.name || 'Unknown'}</strong><div className="md-body-small m3-text-secondary">{p.seller?.sellerType || ''}</div>{p.metadata?.companyName && <div className="md-body-small m3-text-secondary">🏢 {p.metadata.companyName}</div>}</td>
                                                <td>{p.contact || 'N/A'}</td>
                                                <td>{p.metadata?.source ? <span className="m3-chip m3-chip-warning">{p.metadata.source}</span> : '—'}{p.metadata?.scraper && <div className="md-body-small m3-text-secondary" style={{ marginTop: 3 }}>{p.metadata.scraper}</div>}</td>
                                                <td className="md-body-small">{p.metadata?.postedDate || '—'}</td>
                                                <td><span className={`m3-chip ${p.isActive ? 'm3-chip-success' : 'm3-chip-error'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                                                <td>{p.isActive && <button onClick={async () => { if (window.confirm('Mark as sold?')) { try { await axios.put(`${API_BASE_URL}/properties/${p.id}/mark-sold`, {}); fetchData(); } catch { alert('Failed'); } } }} className="m3-btn m3-btn-error m3-btn-sm">Mark Sold</button>}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── LEADS ────────────────────────── */}
                        {activeTab === 'leads' && (
                            <div>
                                <h2 className="md-title-large" style={{ marginBottom: 16 }}>All Leads ({leads.length})</h2>
                                <div className="m3-table-container">
                                    <table className="m3-table">
                                        <thead><tr>
                                            <th>Buyer</th><th>Seller</th><th>Property</th><th>Price</th><th>State</th><th>Match Score</th><th>Created</th><th>Updated</th>
                                        </tr></thead>
                                        <tbody>{leads.map((l: any) => (
                                            <tr key={l.id}>
                                                <td><strong>{l.buyer.name}</strong><br /><span className="md-body-small m3-text-secondary">{l.buyer.email}</span>{l.buyer.phone && <div className="md-body-small m3-text-secondary">📞 {l.buyer.phone}</div>}</td>
                                                <td><strong>{l.property?.seller?.name || 'Unknown'}</strong><br /><span className="md-body-small m3-text-secondary">{l.property?.seller?.email || ''}</span>{l.property?.seller?.sellerType && <div style={{ marginTop: 4 }}><span className={getSellerRoleChipClass(l.property.seller.sellerType)}>{l.property.seller.sellerType}</span></div>}</td>
                                                <td>{l.property.title}<br /><span className="md-body-small m3-text-secondary">{l.property.locality}</span>{l.property.bhk && <span className="md-body-small m3-text-secondary"> · {l.property.bhk} BHK</span>}{l.property.area && <span className="md-body-small m3-text-secondary"> · {l.property.area} sqft</span>}</td>
                                                <td style={{ fontWeight: 600 }} className="m3-text-success">{l.property.price ? fmtPrice(l.property.price) : '—'}</td>
                                                <td><span className={`m3-chip ${getStateChipClass(l.state)}`}>{l.state}</span></td>
                                                <td>{l.matchScore ? <strong style={{ color: getScoreColor(l.matchScore) }}>{l.matchScore.toFixed(1)}%</strong> : 'N/A'}</td>
                                                <td className="md-body-small">{fmt(l.createdAt)}</td>
                                                <td className="md-body-small">{fmt(l.updatedAt)}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── MATCHES ──────────────────────── */}
                        {activeTab === 'matches' && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                    <h2 className="md-title-large" style={{ margin: 0 }}>All Matches ({matches.length})</h2>
                                    <button onClick={async () => { setRefreshingMatches(true); setActionMessage(null); try { const res = await axios.post(`${API_BASE_URL}/matches/refresh-all`); setActionMessage(res.data.success ? `[OK] ${res.data.message} — ${res.data.totalMatches} total matches` : `[ERR] ${res.data.error}`); fetchData(); } catch (err: any) { setActionMessage(`[ERR] ${err.response?.data?.error || err.message}`); } finally { setRefreshingMatches(false); } }} disabled={refreshingMatches} className="m3-btn m3-btn-filled m3-btn-sm">{refreshingMatches ? 'Refreshing...' : '⟳ Refresh All Matches'}</button>
                                </div>
                                <div className="m3-table-container">
                                    <table className="m3-table">
                                        <thead><tr>
                                            <th>Buyer</th><th>Seller</th><th>Property</th><th>Match</th><th>Location</th><th>Budget</th><th>Size</th><th>Amenities</th><th>Created</th>
                                        </tr></thead>
                                        <tbody>{matches.map(m => (
                                            <tr key={m.id}>
                                                <td><strong>{m.buyer?.name || 'Deleted'}</strong><br /><span className="md-body-small m3-text-secondary">{m.buyer?.email || ''}</span></td>
                                                <td><strong>{m.property?.seller?.name || 'Unknown'}</strong><br /><span className="md-body-small m3-text-secondary">{m.property?.seller?.email || ''}</span>{m.property?.seller?.sellerType && <div style={{ marginTop: 4 }}><span className={getSellerRoleChipClass(m.property?.seller?.sellerType)}>{m.property?.seller?.sellerType}</span></div>}</td>
                                                <td>{m.property?.title || '(Deleted)'}<br /><span className="md-body-small m3-text-secondary">{m.property?.locality || ''}</span></td>
                                                <td><strong style={{ color: getScoreColor(m.matchScore) }}>{m.matchScore.toFixed(1)}%</strong></td>
                                                <td><span className={getScoreClass(m.locationScore)}>{m.locationScore?.toFixed(1) || 'N/A'}%</span></td>
                                                <td><span className={getScoreClass(m.budgetScore)}>{m.budgetScore?.toFixed(1) || 'N/A'}%</span></td>
                                                <td><span className={getScoreClass(m.sizeScore)}>{m.sizeScore?.toFixed(1) || 'N/A'}%</span></td>
                                                <td><span className={getScoreClass(m.amenitiesScore)}>{m.amenitiesScore?.toFixed(1) || 'N/A'}%</span></td>
                                                <td className="md-body-small">{fmt(m.createdAt)}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── LOGS ─────────────────────────── */}
                        {activeTab === 'logs' && (
                            <div>
                                <h2 className="md-title-large" style={{ marginBottom: 16 }}>Workflow Event Logs ({logs.length})</h2>
                                <div className="m3-table-container">
                                    <table className="m3-table">
                                        <thead><tr>
                                            <th>Timestamp</th><th>Event Type</th><th>From State</th><th>To State</th><th>Description</th>
                                        </tr></thead>
                                        <tbody>{logs.map(log => (
                                            <tr key={log.id}>
                                                <td className="md-body-small">{fmt(log.createdAt)}</td>
                                                <td><span className={`m3-chip ${getEventChipClass(log.eventType)}`}>{log.eventType}</span></td>
                                                <td>{log.fromState || '-'}</td>
                                                <td>{log.toState || '-'}</td>
                                                <td className="md-body-small">{log.description || '-'}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── MANUAL SCRAPE ────────────────── */}
                        {activeTab === 'manual-scrape' && (
                            <div>
                                <h2 className="md-title-large" style={{ marginBottom: 8 }}>Manual Scrape</h2>
                                <p className="md-body-medium m3-text-secondary" style={{ marginBottom: 20 }}>Trigger a manual scrape for properties in a specific city.</p>
                                <div className="m3-surface-container m3-flex m3-gap-md m3-flex-wrap" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <label className="m3-input-label">City Name</label>
                                        <input type="text" value={manualCity} onChange={(e) => setManualCity(e.target.value)} placeholder="e.g. Pune, Mumbai, Delhi" className="m3-input" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <label className="m3-input-label">Scraper</label>
                                        <select value={manualScraper} onChange={(e) => setManualScraper(e.target.value)} className="m3-input m3-select">
                                            <option value="" disabled>Select a scraper</option>
                                            {availableScrapers.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <button onClick={async () => { if (!manualCity || !manualScraper) { alert("Provide both city and scraper"); return; } setManualScraping(true); setManualScrapeMessage(null); try { const res = await axios.post(`${API_BASE_URL}/admin/trigger-scrape`, { city: manualCity, scraper: manualScraper }); setManualScrapeMessage(res.data.success ? `✓ Scrape triggered. Results: ${JSON.stringify(res.data.results)}` : `✗ ${res.data.error || 'Failed'}`); } catch (err: any) { setManualScrapeMessage(`✗ ${err.response?.data?.error || err.message}`); } finally { setManualScraping(false); } }} disabled={manualScraping} className="m3-btn m3-btn-filled">{manualScraping ? 'Scraping...' : 'Trigger Scrape'}</button>
                                </div>
                                {manualScrapeMessage && <div className={`m3-alert ${manualScrapeMessage.startsWith('✓') ? 'm3-alert-success' : 'm3-alert-error'}`}>{manualScrapeMessage}</div>}
                            </div>
                        )}

                        {/* ── FB SCRAPE ────────────────────── */}
                        {activeTab === 'fb-scrape' && (
                            <div>
                                <h2 className="md-title-large" style={{ marginBottom: 8 }}>Facebook Group Scraper</h2>
                                <p className="md-body-medium m3-text-secondary" style={{ marginBottom: 20 }}>Scrape real estate listings from Facebook groups using Apify + Groq LLM extraction.</p>

                                <div className="m3-surface-container m3-flex m3-gap-md m3-flex-wrap" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
                                    <div style={{ flex: 1, minWidth: 300 }}>
                                        <label className="m3-input-label">Facebook Group URL</label>
                                        <input type="text" value={fbGroupUrl} onChange={(e) => setFbGroupUrl(e.target.value)} placeholder="https://www.facebook.com/groups/..." className="m3-input" />
                                    </div>
                                    <div style={{ width: 140 }}>
                                        <label className="m3-input-label">No. of Posts</label>
                                        <input type="number" value={fbPostLimit} onChange={(e) => setFbPostLimit(Number(e.target.value))} min={1} max={100} className="m3-input" />
                                    </div>
                                    <button onClick={async () => { if (!fbGroupUrl.trim()) { setFbError('Please enter a URL'); return; } setFbScraping(true); setFbError(null); setFbMessage(null); setFbResults([]); try { const res = await axios.post(`${API_BASE_URL}/admin/fb-scrape`, { groupUrl: fbGroupUrl.trim(), limit: fbPostLimit }); if (res.data.success && Array.isArray(res.data.data)) { setFbResults(res.data.data); setFbMessage(`✓ Scraped ${res.data.data.length} listing(s)`); } else { setFbError('Unexpected response'); } } catch (err: any) { setFbError(err.response?.data?.error || err.message); } finally { setFbScraping(false); } }} disabled={fbScraping} className="m3-btn m3-btn-filled">{fbScraping ? 'Scraping...' : 'Scrape Group'}</button>
                                    <button onClick={async () => { setFbScraping(true); setFbError(null); setFbMessage(null); setFbResults([]); try { const res = await axios.get(`${API_BASE_URL}/admin/fb-load-csv`); if (res.data.success && Array.isArray(res.data.data)) { setFbResults(res.data.data); setFbMessage(`✓ Loaded ${res.data.data.length} listing(s) from CSV`); } else { setFbError('Unexpected response'); } } catch (err: any) { setFbError(err.response?.data?.error || err.message); } finally { setFbScraping(false); } }} disabled={fbScraping} className="m3-btn m3-btn-tonal">Load CSV</button>
                                </div>

                                {/* Saved Links */}
                                <div className="m3-surface-container-low" style={{ marginBottom: 16, padding: '12px 16px' }}>
                                    <div className="m3-flex-between" style={{ marginBottom: 8 }}>
                                        <span className="md-label-medium m3-text-secondary">💾 Saved Links</span>
                                        <button
                                            onClick={() => {
                                                if (!fbGroupUrl.trim()) return;
                                                const label = prompt('Label for this link:', new URL(fbGroupUrl).pathname.split('/').pop() || 'Group');
                                                if (label) addFbLink(fbGroupUrl.trim(), label);
                                            }}
                                            className="m3-btn m3-btn-tonal m3-btn-sm"
                                            disabled={!fbGroupUrl.trim()}
                                        >Save Current URL</button>
                                    </div>
                                    {savedFbLinks.length === 0 ? (
                                        <span className="md-body-small m3-text-secondary">No saved links yet. Enter a URL above and click "Save Current URL".</span>
                                    ) : (
                                        <div className="m3-saved-links">
                                            {savedFbLinks.map((link, idx) => (
                                                <button key={idx} className="m3-saved-link-chip" onClick={() => setFbGroupUrl(link.url)} title={link.url}>
                                                    📘 {link.label}
                                                    <span
                                                        className="m3-saved-link-chip__delete"
                                                        onClick={(e) => { e.stopPropagation(); removeFbLink(idx); }}
                                                        title="Remove"
                                                    >✕</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {fbError && <div className="m3-alert m3-alert-error">{fbError}</div>}
                                {fbMessage && <div className="m3-alert m3-alert-success">{fbMessage}</div>}

                                {fbScraping && (
                                    <div className="m3-loading" style={{ padding: 40 }}>
                                        <p className="md-title-medium">Scraping in progress...</p>
                                        <p className="md-body-small m3-text-secondary" style={{ marginTop: 4 }}>This may take a few minutes.</p>
                                    </div>
                                )}

                                {fbResults.length > 0 && (
                                    <div>
                                        <div className="m3-flex-between" style={{ marginBottom: 12 }}>
                                            <h3 className="md-title-medium">Scraped Results ({fbResults.length})</h3>
                                            <button onClick={async () => { setFbSaving(true); setFbError(null); try { const res = await axios.post(`${API_BASE_URL}/admin/fb-save`, { rows: fbResults }); if (res.data.success) { setFbMessage(`✓ Saved ${res.data.saved} properties!` + (res.data.errors?.length > 0 ? ` (${res.data.errors.length} errors)` : '')); setFbResults([]); } else { setFbError('Save failed'); } } catch (err: any) { setFbError(err.response?.data?.error || err.message); } finally { setFbSaving(false); } }} disabled={fbSaving} className="m3-btn m3-btn-filled">{fbSaving ? 'Saving...' : 'Save to Database'}</button>
                                        </div>
                                        <div className="m3-table-container">
                                            <table className="m3-table" style={{ fontSize: 13 }}>
                                                <thead><tr>
                                                    <th>✕</th><th>Title</th><th>Locality</th><th>Type</th><th>BHK</th><th>Area</th><th>Price</th><th>Amenities</th><th>Seller</th><th>Contact</th><th>Status</th><th>Date</th><th>Group</th>
                                                </tr></thead>
                                                <tbody>{fbResults.map((row, idx) => (
                                                    <tr key={idx}>
                                                        <td style={{ textAlign: 'center' }}><button onClick={() => setFbResults(prev => prev.filter((_, i) => i !== idx))} className="m3-btn m3-btn-error m3-btn-sm" style={{ padding: '4px 8px', minHeight: 'unset' }}>✕</button></td>
                                                        <td style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.TITLE}</td>
                                                        <td>{row.LOCALITY}</td>
                                                        <td><span className="m3-chip m3-chip-primary" style={{ fontSize: 11 }}>{row.TYPE}</span></td>
                                                        <td>{row.BHK}</td>
                                                        <td>{row.AREA}</td>
                                                        <td style={{ fontWeight: 600 }} className="m3-text-success">{row.PRICE}</td>
                                                        <td className="md-body-small" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.AMENITIES}</td>
                                                        <td>{row.SELLER}</td>
                                                        <td>{row.CONTACT}</td>
                                                        <td><span className={`m3-chip ${row.STATUS === 'ready_to_move' ? 'm3-chip-success' : row.STATUS === 'under_construction' ? 'm3-chip-warning' : 'm3-chip-filled'}`} style={{ fontSize: 10 }}>{row.STATUS}</span></td>
                                                        <td className="md-body-small">{row.CREATED_AT}</td>
                                                        <td>{row.GROUP_URL && row.GROUP_URL !== '-' ? <a href={row.GROUP_URL} target="_blank" rel="noopener noreferrer" className="m3-text-primary md-body-small">View ↗</a> : '-'}</td>
                                                    </tr>
                                                ))}</tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {!fbScraping && fbResults.length === 0 && !fbMessage && (
                                    <div className="m3-empty-state">
                                        <p>Enter a Facebook group URL and click <strong>Scrape Group</strong> to get started.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── SETTINGS - PROFILE ──────────── */}
                        {activeTab === 'settings-profile' && (
                            <div>
                                <h2 className="md-title-large" style={{ marginBottom: 16 }}>Profile</h2>
                                <div className="m3-settings-section">
                                    <div className="m3-card m3-card-outlined" style={{ padding: 24 }}>
                                        <div className="m3-flex m3-gap-md" style={{ alignItems: 'center', marginBottom: 20 }}>
                                            <div className="m3-sidebar__user-avatar" style={{ width: 56, height: 56, fontSize: 24 }}>
                                                {userEmail.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="md-title-medium">{userEmail}</div>
                                                <div className="md-body-small m3-text-secondary">Administrator</div>
                                            </div>
                                        </div>
                                        <div className="m3-settings-row">
                                            <div><div className="md-label-large">Email</div><div className="md-body-medium m3-text-secondary">{userEmail}</div></div>
                                        </div>
                                        <div className="m3-settings-row">
                                            <div><div className="md-label-large">Role</div><div className="md-body-medium m3-text-secondary">Admin</div></div>
                                        </div>
                                        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                                            <button onClick={onLogout} className="m3-btn m3-btn-error-tonal" style={{ width: '100%' }}>Logout</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── SETTINGS - THEME ────────────── */}
                        {activeTab === 'settings-theme' && (
                            <div>
                                <h2 className="md-title-large" style={{ marginBottom: 16 }}>Theme</h2>
                                <div className="m3-settings-section">
                                    <div className="m3-card m3-card-outlined" style={{ padding: 24 }}>
                                        <div className="m3-settings-row">
                                            <div>
                                                <div className="md-label-large">Dark Mode</div>
                                                <div className="md-body-small m3-text-secondary">Toggle between light and dark theme</div>
                                            </div>
                                            <label className="m3-switch">
                                                <input type="checkbox" checked={theme === 'dark'} onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
                                                <span className="m3-switch__track" />
                                            </label>
                                        </div>
                                        <div className="m3-settings-row">
                                            <div>
                                                <div className="md-label-large">Current Theme</div>
                                                <div className="md-body-small m3-text-secondary">{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>{/* close m3-fade-in */}

                    {/* Summary Stats */}
                    <div className="m3-surface-container" style={{ marginTop: 30, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, textAlign: 'center' }}>
                        {[
                            { label: 'Buyers', count: buyers.length, color: 'var(--md-sys-color-primary)' },
                            { label: 'Sellers', count: sellers.length, color: 'var(--md-sys-color-tertiary)' },
                            { label: 'Properties', count: properties.length, color: 'var(--md-sys-color-warning)' },
                            { label: 'Leads', count: leads.length, color: 'var(--md-sys-color-secondary)' },
                            { label: 'Matches', count: matches.length, color: 'var(--md-sys-color-error)' },
                            { label: 'Event Logs', count: logs.length, color: 'var(--md-sys-color-outline)' },
                        ].map(s => (
                            <div key={s.label}>
                                <h3 className="md-label-medium m3-text-secondary" style={{ marginBottom: 10 }}>{s.label}</h3>
                                <p className="md-display-small" style={{ color: s.color }}>{s.count}</p>
                            </div>
                        ))}
                    </div>

                    {/* Property Map Tab */}
                    {activeTab === 'property-map' && (
                        <div>
                            <h2 className="md-title-large" style={{ marginBottom: 12 }}>All Properties Map</h2>
                            <div style={{ marginBottom: 10 }}><MapSearchBar map={propertyMapInstance.current} placeholder="Search for a location..." /></div>
                            <div ref={propertyMapRef} className="m3-map-container" style={{ height: 600 }} />
                            <PropertyMapLoader mapRef={propertyMapRef} mapInstance={propertyMapInstance} activeTab={activeTab} />
                        </div>
                    )}

                    {/* Buyer Map Tab */}
                    {activeTab === 'buyer-map' && (
                        <div>
                            <h2 className="md-title-large" style={{ marginBottom: 12 }}>Buyer Preferred Localities</h2>
                            <div style={{ marginBottom: 10 }}><MapSearchBar map={buyerMapInstance.current} placeholder="Search for a location..." /></div>
                            <div ref={buyerMapRef} className="m3-map-container" style={{ height: 600 }} />
                            <BuyerMapLoader mapRef={buyerMapRef} mapInstance={buyerMapInstance} activeTab={activeTab} />
                        </div>
                    )}
                </div>{/* close m3-container */}
            </main>
        </div>
    );
};

/* ── Embedded map loaders ────────────────── */

function PropertyMapLoader({ mapRef, mapInstance, activeTab }: { mapRef: React.RefObject<HTMLDivElement | null>; mapInstance: React.MutableRefObject<L.Map | null>; activeTab: string; }) {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    useEffect(() => {
        if (activeTab !== 'property-map' || !mapRef.current) return;
        if (mapInstance.current) { mapInstance.current.invalidateSize(); return; }
        const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
        mapInstance.current = map;
        const token = localStorage.getItem('hublet_auth_token');
        fetch(`${API_BASE}/properties/map`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then((data: Array<{ id: string; title: string; locality: string; bhk: number; price: number; area: number; propertyType: string; lat: number; lon: number }>) => {
                const bounds: [number, number][] = [];
                const colors: Record<string, string> = { apartment: '#3949AB', house: '#4B607C', villa: '#E67700', plot: '#7C4DFF' };
                data.forEach(p => {
                    const color = colors[p.propertyType] || '#7C4DFF';
                    const icon = L.divIcon({ className: '', html: `<div style="background:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:11px;font-weight:bold;">${p.bhk}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28] });
                    const formatP = (price: number) => price >= 10000000 ? `₹${(price / 10000000).toFixed(2)} Cr` : price >= 100000 ? `₹${(price / 100000).toFixed(1)} L` : `₹${price.toLocaleString('en-IN')}`;
                    L.marker([p.lat, p.lon], { icon }).bindPopup(`<div style="min-width:200px;font-family:Inter,sans-serif;"><h4 style="margin:0 0 6px;color:#191C1C;">${p.title}</h4><p style="margin:2px 0;font-size:13px;color:#3F4949;">${p.locality}</p><p style="margin:2px 0;font-size:13px;color:#3F4949;">${p.bhk} BHK | ${p.area} sqft | ${p.propertyType}</p><p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#3949AB;">${formatP(p.price)}</p></div>`).addTo(map);
                    bounds.push([p.lat, p.lon]);
                });
                if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
            }).catch(console.error);
        return () => { map.remove(); mapInstance.current = null; };
    }, [activeTab]);
    return null;
}

function BuyerMapLoader({ mapRef, mapInstance, activeTab }: { mapRef: React.RefObject<HTMLDivElement | null>; mapInstance: React.MutableRefObject<L.Map | null>; activeTab: string; }) {
    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    useEffect(() => {
        if (activeTab !== 'buyer-map' || !mapRef.current) return;
        if (mapInstance.current) { mapInstance.current.invalidateSize(); return; }
        const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
        mapInstance.current = map;
        const token = localStorage.getItem('hublet_auth_token');
        fetch(`${API_BASE}/buyers/localities-map`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json())
            .then((data: Array<{ buyerName: string; locality: string; lat: number; lon: number }>) => {
                const bounds: [number, number][] = [];
                const icon = L.divIcon({ className: '', html: `<div style="background:#3949AB;width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;"><span style="color:white;font-size:11px;font-weight:bold;">B</span></div>`, iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] });
                data.forEach(p => { L.marker([p.lat, p.lon], { icon }).bindPopup(`<div style="font-family:Inter,sans-serif;"><strong>${p.locality}</strong><br/><span style="font-size:12px;color:#3F4949;">Interested: ${p.buyerName}</span></div>`).addTo(map); bounds.push([p.lat, p.lon]); });
                if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
            }).catch(console.error);
        return () => { map.remove(); mapInstance.current = null; };
    }, [activeTab]);
    return null;
}
