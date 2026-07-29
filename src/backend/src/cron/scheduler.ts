
import cron from 'node-cron';
import { ScrapingService } from '../services/scraping.service';

// Default cities to scrape
const TARGET_CITIES = ['mumbai', 'new-delhi', 'hyderabad'];

// Read scraper name from env (default: 'magicbricks-direct')
const SCRAPER = process.env.SCRAPER || 'magicbricks-direct';

export const setupScheduler = () => {
    console.log('[Scheduler] Initializing background tasks...');
    console.log(`[Scheduler] Active scraper: ${SCRAPER}`);

    // Schedule task to run every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        console.log('[Scheduler] Starting scheduled scraping job...');
        for (const city of TARGET_CITIES) {
            try {
                const result = await ScrapingService.scrapeCity(city, 20, SCRAPER);
                console.log(`[Scheduler] ${city}: Added ${result.added} properties.`);
            } catch (e) {
                console.error(`[Scheduler] Failed to scrape ${city}:`, e);
            }
        }
    });

    console.log('[Scheduler] Scraping job scheduled (every 6 hours).');
};

export const runManualScrape = async (city?: string, scraper?: string) => {
    const cities = city ? [city] : TARGET_CITIES;
    const activeScraper = scraper || SCRAPER;
    console.log(`[Scheduler] Manual scrape triggered for: ${cities.join(', ')} (scraper: ${activeScraper})`);

    const results = [];
    for (const c of cities) {
        try {
            const res = await ScrapingService.scrapeCity(c, 5, activeScraper);
            results.push({ city: c, added: res.added, errors: res.errors });
        } catch (e: any) {
            results.push({ city: c, error: e.message });
        }
    }
    return results;
};
