/**
 * Geolocation Service
 * Uses OpenStreetMap Nominatim API for geocoding addresses to coordinates.
 * Includes basic rate limiting (1 request per second max) to comply with Nominatim's fair use policy.
 */

// Simple delay function
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

let lastRequestTime = 0;

export interface Coordinates {
    lat: number;
    lon: number;
}

export class GeocodeService {
    /**
     * Geocode an address/locality into coordinates.
     */
    static async geocodeAddress(address: string): Promise<Coordinates | null> {
        if (!address || address.trim() === '') {
            return null;
        }

        try {
            // Apply rate limit (1 req/sec)
            const now = Date.now();
            const timeSinceLast = now - lastRequestTime;
            if (timeSinceLast < 1000) {
                await delay(1000 - timeSinceLast);
            }
            lastRequestTime = Date.now();

            // Format address for url
            // Adding a general bounding/bias to India since this is for Hublet, 
            // but the query itself is the main driver.
            const query = encodeURIComponent(address + ', India');
            const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

            // Note: Nominatim requires a User-Agent
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'HubletBackend/1.0 (hublet@iiit.ac.in)',
                    'Accept-Language': 'en'
                }
            });

            if (!response.ok) {
                console.error(`Geocoding error for "${address}": API returned ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json() as any[];

            if (data && data.length > 0) {
                const result = data[0];
                return {
                    lat: parseFloat(result.lat),
                    lon: parseFloat(result.lon)
                };
            }

            return null;
        } catch (error) {
            console.error(`Geocoding exception for "${address}":`, error);
            return null;
        }
    }

    /**
     * Reverse-geocode a coordinate into OSM's own formatted address string.
     * Used to fill Property.address honestly from a real point we already
     * have - never invents a street number/name, only returns what OSM
     * itself reports for that location.
     */
    static async reverseGeocode(lat: number, lon: number): Promise<string | null> {
        try {
            const now = Date.now();
            const timeSinceLast = now - lastRequestTime;
            if (timeSinceLast < 1000) {
                await delay(1000 - timeSinceLast);
            }
            lastRequestTime = Date.now();

            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'HubletBackend/1.0 (hublet@iiit.ac.in)',
                    'Accept-Language': 'en'
                }
            });

            if (!response.ok) {
                console.error(`Reverse geocoding error for (${lat}, ${lon}): API returned ${response.status} ${response.statusText}`);
                return null;
            }

            const data = await response.json() as any;
            return data?.display_name || null;
        } catch (error) {
            console.error(`Reverse geocoding exception for (${lat}, ${lon}):`, error);
            return null;
        }
    }
}
