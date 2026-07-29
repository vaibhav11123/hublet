/**
 * nearby-places.ts
 *
 * Finds the nearest points of interest for a given lat/lon.
 *
 * Strategy (Rewritten 2026-04):
 * To bypass rate limits (429/504) and ensure speed, we execute ONE single combined
 * Overpass API query using the `around:` operator.
 * 
 * We search:
 * - Airports within 80km
 * - Train/Metro stations within 5km
 * - Bus stations within 5km
 * - Hospitals within 5km
 * 
 * We then parse the bulk results and find the closest of each type locally.
 */

import { haversineDistance } from './haversine';

export interface NearbyPlace {
    name: string;
    distanceKm: number;
    lat: number;
    lon: number;
    osmUrl: string;
    type?: string;
}

export interface NearbyPlaces {
    airport?: NearbyPlace;
    busStation?: NearbyPlace;
    trainStation?: NearbyPlace;
    hospital?: NearbyPlace;
    fetchedAt: string;
    source?: string;
    stale?: boolean;
}

const UA = 'Hublet-RealEstate/1.0 (contact@hublet.demo)';
const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const nearbyCache = new Map<string, { data: NearbyPlaces; fetchedAt: number }>();
const nearbyInFlight = new Map<string, Promise<NearbyPlaces>>();

let overpassQueue: Promise<unknown> = Promise.resolve();
let lastOverpassAt = 0;

function cacheKey(lat: number, lon: number) {
    return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
    const run = async () => {
        const wait = Math.max(0, 1000 - (Date.now() - lastOverpassAt));
        if (wait > 0) await sleep(wait);
        const result = await fn();
        lastOverpassAt = Date.now();
        return result;
    };

    const next = overpassQueue.then(run, run);
    overpassQueue = next.catch(() => undefined);
    return next;
}

async function fetchOverpassOnce(endpoint: string, ql: string) {
    return rateLimited(async () => {
        const r = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
            body: `data=${encodeURIComponent(ql)}`,
            // @ts-ignore (Node 17+ AbortSignal)
            signal: AbortSignal.timeout(20_000),
        });

        if (!r.ok) {
            const body = await r.text();
            throw new Error(`Overpass HTTP ${r.status} at ${endpoint}: ${body}`);
        }

        return (await r.json()) as { elements: any[] };
    });
}

export async function fetchNearbyPlaces(lat: number, lon: number): Promise<NearbyPlaces> {
    const now = Date.now();
    const key = cacheKey(lat, lon);
    const cached = nearbyCache.get(key);
    if (cached && now - cached.fetchedAt <= CACHE_TTL_MS) {
        console.log('[NearbyPlaces] cache hit', key);
        return { ...cached.data, fetchedAt: new Date(cached.fetchedAt).toISOString() };
    }

    if (nearbyInFlight.has(key)) {
        console.log('[NearbyPlaces] in-flight dedupe', key);
        return nearbyInFlight.get(key)!;
    }

    const result: NearbyPlaces = { fetchedAt: new Date().toISOString() };

    const ql = `[out:json][timeout:25];
(
  // Airport (large radius - 80km)
  node["aeroway"="aerodrome"](around:80000,${lat},${lon});
  way["aeroway"="aerodrome"](around:80000,${lat},${lon});
  
  // Train/Metro (5km)
  node["railway"="station"](around:5000,${lat},${lon});
  node["railway"="halt"](around:5000,${lat},${lon});
  node["station"="subway"](around:5000,${lat},${lon});
  
  // Bus (5km)
  node["amenity"="bus_station"](around:5000,${lat},${lon});
  way["amenity"="bus_station"](around:5000,${lat},${lon});
  
  // Hospital (5km)
  node["amenity"="hospital"](around:5000,${lat},${lon});
  way["amenity"="hospital"](around:5000,${lat},${lon});
);
out center;`;

    const promise = (async () => {
        try {
            let data: { elements: any[] } | null = null;
            let usedEndpoint: string | undefined;

            for (let attempt = 0; attempt < 3 && !data; attempt++) {
                for (const endpoint of OVERPASS_ENDPOINTS) {
                    try {
                        data = await fetchOverpassOnce(endpoint, ql);
                        usedEndpoint = endpoint;
                        break;
                    } catch (err: any) {
                        console.warn('[NearbyPlaces] Overpass failed', err.message);
                    }
                }

                if (!data) {
                    const delay = 1000 * Math.pow(2, attempt);
                    await sleep(delay);
                }
            }

            if (!data || !data.elements) {
                console.warn('[NearbyPlaces] Overpass failed after retries', key);
                if (cached) {
                    return {
                        ...cached.data,
                        fetchedAt: new Date(cached.fetchedAt).toISOString(),
                        stale: true,
                    };
                }
                return { ...result, stale: true };
            }

        let bestAirportDist = Infinity, bestBusDist = Infinity;
        let bestTrainDist = Infinity, bestHospDist = Infinity;

        for (const el of data.elements) {
            const eLat = el.lat ?? el.center?.lat;
            const eLon = el.lon ?? el.center?.lon;
            if (!eLat || !eLon) continue;

            const name = el.tags?.name || el.tags?.['name:en'] || el.tags?.ref || '';
            if (!name) continue; // Skip unnamed nodes

            const dist = haversineDistance(lat, lon, eLat, eLon);
            const distanceKm = Math.round(dist * 10) / 10;
            const osmKind = el.type === 'way' ? 'way' : 'node';
            const osmUrl = `https://www.openstreetmap.org/${osmKind}/${el.id}`;

            const tags = el.tags || {};

            // Categorize
            if (tags.aeroway === 'aerodrome' && dist < bestAirportDist) {
                bestAirportDist = dist;
                result.airport = { name, distanceKm, lat: eLat, lon: eLon, osmUrl, type: 'airport' };
            }
            else if (tags.amenity === 'bus_station' && dist < bestBusDist) {
                bestBusDist = dist;
                result.busStation = { name, distanceKm, lat: eLat, lon: eLon, osmUrl, type: 'bus' };
            }
            else if ((tags.railway === 'station' || tags.railway === 'halt' || tags.station === 'subway') && dist < bestTrainDist) {
                bestTrainDist = dist;
                result.trainStation = { name, distanceKm, lat: eLat, lon: eLon, osmUrl, type: 'train' };
            }
            else if (tags.amenity === 'hospital' && dist < bestHospDist) {
                bestHospDist = dist;
                result.hospital = { name, distanceKm, lat: eLat, lon: eLon, osmUrl, type: 'hospital' };
            }
        }

            result.source = usedEndpoint;
            nearbyCache.set(key, { data: result, fetchedAt: now });
            console.log('[NearbyPlaces] cache miss', key, 'stored');
            return result;
        } catch (err: any) {
            console.error('[NearbyPlaces] Overpass error', err.message);
            if (cached) {
                return {
                    ...cached.data,
                    fetchedAt: new Date(cached.fetchedAt).toISOString(),
                    stale: true,
                };
            }
            return { ...result, stale: true };
        } finally {
            nearbyInFlight.delete(key);
        }
    })();

    nearbyInFlight.set(key, promise);
    return promise;
}
