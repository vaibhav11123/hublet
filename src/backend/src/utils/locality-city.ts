/**
 * Derives a real city name from a property's locality string (and, as a last
 * resort, its scraper sourceUrl or its seller's known city).
 *
 * Background: Property.locality is free text and inconsistently formatted.
 * Hand-seeded properties follow "<Area>, <City>" (e.g. "Whitefield,
 * Bangalore"). Scraper-sourced properties sometimes follow the same shape but
 * with a Bangalore neighborhood instead of a real city as the trailing token
 * (e.g. "Shivaji Nagar, MG Road", "Seshadripuram, Bangalore Central"), or have
 * no comma at all (a lowercase, hyphenated city slug like "new-delhi").
 *
 * KNOWN_CITIES is the authoritative city list actually used across this
 * dataset (10 from src/backend/src/scripts/seed-demo-sellers.ts /
 * seed-demo-buyers.ts, plus Ghaziabad/New Delhi which only appear in
 * scraper-derived data as real NCR locations).
 */

export const KNOWN_CITIES = [
    'Bangalore',
    'Hyderabad',
    'Mumbai',
    'Pune',
    'Chennai',
    'Kolkata',
    'Ahmedabad',
    'Jaipur',
    'Kochi',
    'Lucknow',
    'Ghaziabad',
    'New Delhi',
    'Delhi',
];

const CITY_SLUGS = new Map(KNOWN_CITIES.map((c) => [c.toLowerCase().replace(/\s+/g, '-'), c]));
const CITY_NAMES_LOWER = new Map(KNOWN_CITIES.map((c) => [c.toLowerCase(), c]));

export type CityDeriveRule = 'comma-match' | 'no-comma-slug' | 'sourceUrl-fallback' | 'seller-fallback' | 'unresolved';

export interface CityDeriveResult {
    city: string | null;
    rule: CityDeriveRule;
}

/**
 * @param locality property.locality, e.g. "Whitefield, Bangalore" or "new-delhi"
 * @param sourceUrl property.metadata.sourceUrl, if scraper-sourced
 * @param sellerCity the property's seller's metadata.city, if set (must already be JSON.parse'd)
 */
export function deriveCityFromLocality(
    locality: string | null | undefined,
    sourceUrl?: string | null,
    sellerCity?: string | null
): CityDeriveResult {
    const text = (locality || '').trim();

    if (text) {
        if (text.includes(',')) {
            const tail = text.split(',').pop()!.trim().toLowerCase();
            const match = CITY_NAMES_LOWER.get(tail);
            if (match) return { city: match, rule: 'comma-match' };
        } else {
            const slug = text.toLowerCase().replace(/\s+/g, '-');
            const match = CITY_SLUGS.get(slug) || CITY_NAMES_LOWER.get(text.toLowerCase());
            if (match) return { city: match, rule: 'no-comma-slug' };
        }
    }

    if (sourceUrl) {
        const lower = sourceUrl.toLowerCase();
        for (const city of KNOWN_CITIES) {
            const slug = city.toLowerCase().replace(/\s+/g, '-');
            if (lower.includes(slug) || lower.includes(city.toLowerCase().replace(/\s+/g, ''))) {
                return { city, rule: 'sourceUrl-fallback' };
            }
        }
    }

    if (sellerCity && sellerCity.trim()) {
        return { city: sellerCity.trim(), rule: 'seller-fallback' };
    }

    return { city: null, rule: 'unresolved' };
}
