/**
 * Nominatim-based geocoder utility for OpenStreetMap integration.
 * Supports forward geocoding (address → coords) and reverse geocoding (coords → address).
 * Respects Nominatim's 1 request/second usage policy.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Hublet-RealEstate/1.0';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const geoCache = new Map<string, { data: GeocoderResult | null; fetchedAt: number }>();
const inFlight = new Map<string, Promise<GeocoderResult | null>>();

let nominatimQueue: Promise<unknown> = Promise.resolve();
let lastNominatimAt = 0;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
    const run = async () => {
        const wait = Math.max(0, 1000 - (Date.now() - lastNominatimAt));
        if (wait > 0) await sleep(wait);
        const result = await fn();
        lastNominatimAt = Date.now();
        return result;
    };

    const next = nominatimQueue.then(run, run);
    nominatimQueue = next.catch(() => undefined);
    return next;
}

async function fetchJsonWithRetry(url: string): Promise<any | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await rateLimited(async () => fetch(url, {
                headers: { 'User-Agent': USER_AGENT },
                // @ts-ignore (Node 17+ AbortSignal)
                signal: AbortSignal.timeout(10_000),
            }));

            if (response.ok) {
                return response.json();
            }

            if ([429, 502, 503, 504].includes(response.status)) {
                console.warn('[Geocoder] Retryable HTTP', response.status);
            } else {
                return null;
            }
        } catch (error: any) {
            console.warn('[Geocoder] Retryable error', error?.message || error);
        }

        await sleep(1000 * Math.pow(2, attempt));
    }

    return null;
}

export interface GeocoderResult {
    lat: number;
    lon: number;
    displayName: string;
    locality: string; // suburb / city_district / city
    address?: string;
}

interface NominatimSearchResult {
    lat: string;
    lon: string;
    display_name: string;
    address?: {
        suburb?: string;
        city_district?: string;
        neighbourhood?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
    };
}

/**
 * Forward geocode: query string → coordinates + structured address
 */
export async function forwardGeocode(query: string): Promise<GeocoderResult | null> {
    const key = `fwd:${query.trim().toLowerCase()}`;
    const cached = geoCache.get(key);
    const now = Date.now();
    if (cached && now - cached.fetchedAt <= CACHE_TTL_MS) {
        console.log('[Geocoder] cache hit', key);
        return cached.data;
    }

    if (inFlight.has(key)) {
        console.log('[Geocoder] in-flight dedupe', key);
        return inFlight.get(key)!;
    }

    const promise = (async () => {
        try {
            const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=in`;
            const results = (await fetchJsonWithRetry(url)) as NominatimSearchResult[] | null;
            if (!results || results.length === 0) return null;

            const result = results[0];
            const addr = result.address;
            const locality = addr?.suburb || addr?.neighbourhood || addr?.city_district || addr?.city || addr?.town || addr?.village || '';
            const data = {
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
                displayName: result.display_name,
                locality,
                address: result.display_name,
            };

            geoCache.set(key, { data, fetchedAt: now });
            console.log('[Geocoder] cache miss', key, 'stored');
            return data;
        } finally {
            inFlight.delete(key);
        }
    })();

    inFlight.set(key, promise);
    return promise;
}

/**
 * Reverse geocode: coordinates → structured address + locality
 */
export async function reverseGeocode(lat: number, lon: number): Promise<GeocoderResult | null> {
    const key = `rev:${lat.toFixed(3)},${lon.toFixed(3)}`;
    const cached = geoCache.get(key);
    const now = Date.now();
    if (cached && now - cached.fetchedAt <= CACHE_TTL_MS) {
        console.log('[Geocoder] cache hit', key);
        return cached.data;
    }

    if (inFlight.has(key)) {
        console.log('[Geocoder] in-flight dedupe', key);
        return inFlight.get(key)!;
    }

    const promise = (async () => {
        try {
            const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
            const result = (await fetchJsonWithRetry(url)) as NominatimSearchResult | null;
            if (!result) return null;

            const addr = result.address;
            const locality = addr?.suburb || addr?.neighbourhood || addr?.city_district || addr?.city || addr?.town || addr?.village || '';
            const data = {
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
                displayName: result.display_name,
                locality,
                address: result.display_name,
            };

            geoCache.set(key, { data, fetchedAt: now });
            console.log('[Geocoder] cache miss', key, 'stored');
            return data;
        } finally {
            inFlight.delete(key);
        }
    })();

    inFlight.set(key, promise);
    return promise;
}

/**
 * Geocode a locality name (best-effort, non-blocking).
 * Appends ", India" to bias results to India.
 */
export async function geocodeLocality(localityName: string): Promise<{ lat: number; lon: number } | null> {
    const result = await forwardGeocode(`${localityName}, India`);
    if (!result) return null;
    return { lat: result.lat, lon: result.lon };
}

/**
 * Geocode multiple localities with rate-limiting (1 req/sec).
 * Returns array of { name, lat, lon } for successfully geocoded localities.
 */
export async function geocodeLocalities(
    localities: string[]
): Promise<Array<{ name: string; lat: number; lon: number }>> {
    const results: Array<{ name: string; lat: number; lon: number }> = [];

    for (const loc of localities) {
        const coords = await geocodeLocality(loc);
        if (coords) {
            results.push({ name: loc, lat: coords.lat, lon: coords.lon });
        }
        // Rate limit: wait 1 second between requests
        if (localities.indexOf(loc) < localities.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1100));
        }
    }

    return results;
}
