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
}
