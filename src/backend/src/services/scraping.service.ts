
import { spawn } from 'child_process';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { MatchingService } from './matching.service';
import { LeadService } from './lead.service';
import { BuyerService } from './buyer.service';
import { PropertyService } from './property.service';
import { logCredential } from '../utils/credential-logger';

const prisma = new PrismaClient();

/**
 * Strict JSON schema — all scrapers output this shape.
 * Missing fields are filled with null/0/[] by the Python schema validator.
 */
interface ScrapedProperty {
    title: string;
    price: number;
    area: number;
    locality: string;
    city: string;
    description: string;
    sourceUrl: string;
    externalId: string;
    source: string;
    bhk: number;
    amenities: string[];
    propertyType: string;
    sellerName: string;
    sellerType: string;
    ownerName: string;
    companyName: string;
    imageUrl: string;
    landmark: string;
    postedDate: string;
}

export class ScrapingService {
    private static SCRAPER_DIR = (() => {
        const fs = require('fs');
        const candidates = [
            path.join(process.cwd(), 'scraper'),
            path.join(__dirname, '../scraper'),
            path.join(__dirname, '../../scraper'),
            path.join(__dirname, '../../../scraper'),
        ];
        for (const c of candidates) {
            if (fs.existsSync(path.join(c, 'scraper.py'))) return c;
        }
        return path.join(process.cwd(), 'scraper');
    })();
    // Resolve python: venv inside scraper dir takes priority (always has deps installed)
    // then explicit PYTHON_PATH env var, then system python3
    private static PYTHON_EXEC_PATH = (() => {
        const fs = require('fs');
        const localVenvPosix = path.join(process.cwd(), '.venv', 'bin', 'python');
        const venvPythonPosix = path.join(ScrapingService.SCRAPER_DIR, 'venv', 'bin', 'python');
        const venvPythonWindows = path.join(ScrapingService.SCRAPER_DIR, 'venv', 'Scripts', 'python.exe');
        if (fs.existsSync(localVenvPosix)) return localVenvPosix;
        if (fs.existsSync(venvPythonPosix)) return venvPythonPosix;
        if (fs.existsSync(venvPythonWindows)) return venvPythonWindows;
        if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
        return process.platform === 'win32' ? 'python' : 'python3';
    })();
    private static PYTHON_SCRIPT_PATH = path.join(ScrapingService.SCRAPER_DIR, 'scraper.py');

    // Helper to get or create a seller based on scraped data
    private static async getOrCreateSeller(name: string = 'System Scraper', type: string = 'system') {
        const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const email = `${safeName}@hublet.scraped`;

        let seller = await prisma.seller.findUnique({
            where: { email: email }
        });

        if (!seller) {
            seller = await prisma.seller.create({
                data: {
                    name: name,
                    email: email,
                    phone: '0000000000',
                    sellerType: type.toLowerCase(),
                    rating: 4.0,
                    completedDeals: 0
                }
            });
            logCredential({ role: 'seller', name, email, password: '(scraped-no-password)', source: 'scraper' });
            console.log(`[ScrapingService] Created new seller: ${name} (${type})`);
        }
        return seller.id;
    }

    // Helper to generate a random buyer name
    private static getRandomName() {
        const firstNames = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Arjun', 'Rohan', 'Ishaan', 'Zara', 'Diya', 'Ananya', 'Riya', 'Kavya'];
        const lastNames = ['Sharma', 'Patel', 'Mehta', 'Singh', 'Gupta', 'Kumar', 'Reddy', 'Das', 'Joshi', 'Nair'];
        return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    }

    // Generate a synthetic buyer interested in this property
    private static async createSyntheticBuyer(property: any) {
        try {
            const name = this.getRandomName();
            const email = `buyer.${Date.now()}.${Math.floor(Math.random() * 1000)}@example.com`;

            const budgetMin = Math.floor(property.price * 0.8);
            const budgetMax = Math.floor(property.price * 1.2);
            const areaMin = Math.floor(property.area * 0.8);
            const areaMax = Math.floor(property.area * 1.2);

            const buyer = await BuyerService.createBuyer({
                name: name,
                email: email,
                phone: `9${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
                areaMin: areaMin,
                areaMax: areaMax,
                budgetMin: budgetMin,
                budgetMax: budgetMax,
                bhk: property.bhk,
                amenities: property.amenities,
                metadata: {
                    source: 'synthetic-scraper',
                    generatedForPropertyId: property.id,
                    interest: 'high'
                }
            });
            logCredential({ role: 'buyer', name, email, password: '(synthetic-no-password)', source: 'scraper' });
            console.log(`[ScrapingService] Created synthetic buyer: ${buyer.name} (Budget: ${budgetMin}-${budgetMax})`);
            return buyer;
        } catch (error: any) {
            console.error(`[ScrapingService] Failed to create synthetic buyer: ${error.message}`);
        }
    }

    /**
     * List all available scrapers by calling the Python registry.
     */
    static async listScrapers(): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(ScrapingService.PYTHON_EXEC_PATH, [
                this.PYTHON_SCRIPT_PATH,
                '--list-scrapers'
            ], {
                cwd: ScrapingService.SCRAPER_DIR,
                env: { ...process.env, PYTHONPATH: ScrapingService.SCRAPER_DIR }
            });

            let dataString = '';
            let errorString = '';

            pythonProcess.stdout.on('data', (data) => { dataString += data.toString(); });
            pythonProcess.stderr.on('data', (data) => { errorString += data.toString(); });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Failed to list scrapers: ${errorString}`));
                }
                try {
                    resolve(JSON.parse(dataString));
                } catch (err) {
                    reject(new Error('Invalid JSON from scraper registry'));
                }
            });
        });
    }

    /**
     * Scrape a city using the specified scraper.
     * The scraper name maps to a Python parser via the registry.
     * The service is completely scraper-agnostic — it only consumes the strict JSON schema.
     */
    static async scrapeCity(city: string, limit: number = 10, scraper: string = 'magicbricks-direct'): Promise<{ added: number, errors: string[] }> {
        return new Promise(async (resolve, reject) => {
            console.log(`[ScrapingService] Starting scrape for ${city} (limit: ${limit}, scraper: ${scraper})`);
            console.log(`[ScrapingService] Python: ${ScrapingService.PYTHON_EXEC_PATH}`);
            console.log(`[ScrapingService] Script: ${this.PYTHON_SCRIPT_PATH}`);
            console.log(`[ScrapingService] CWD:    ${ScrapingService.SCRAPER_DIR}`);

            const args = [
                this.PYTHON_SCRIPT_PATH,
                '--scraper', scraper,
                '--city', city,
                '--limit', limit.toString(),
            ];

            // Pass appropriate API tokens based on scraper type
            if (scraper.includes('apify')) {
                const apifyToken = process.env.APIFY_TOKEN;
                if (!apifyToken) {
                    return reject(new Error('APIFY_TOKEN environment variable is required for Apify scrapers'));
                }
                args.push('--token', apifyToken);
            }
            if (scraper.includes('zenrows')) {
                const zenrowsKey = process.env.ZENROWS_API_KEY;
                if (!zenrowsKey) {
                    return reject(new Error('ZENROWS_API_KEY environment variable is required for ZenRows scrapers'));
                }
                args.push('--zenrows-key', zenrowsKey);
            }

            const pythonProcess = spawn(ScrapingService.PYTHON_EXEC_PATH, args, {
                cwd: ScrapingService.SCRAPER_DIR,
                env: { ...process.env, PYTHONPATH: ScrapingService.SCRAPER_DIR }
            });

            let dataString = '';
            let errorString = '';

            pythonProcess.stdout.on('data', (data) => {
                dataString += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                console.error(`[ScrapingService] STDERR: ${msg}`);
                errorString += msg;
            });

            pythonProcess.on('close', async (code) => {
                if (code !== 0) {
                    console.error(`[ScrapingService] Python script exited with code ${code}: ${errorString}`);
                    return reject(new Error(`Scraper failed: ${errorString}`));
                }

                try {
                    console.log(`[ScrapingService] Raw stdout length: ${dataString.length}`);
                    console.log(`[ScrapingService] Raw stdout (first 500 chars): ${dataString.substring(0, 500)}`);
                    if (errorString) {
                        console.warn(`[ScrapingService] Stderr (non-fatal): ${errorString.substring(0, 500)}`);
                    }
                    const listings: ScrapedProperty[] = JSON.parse(dataString);
                    console.log(`[ScrapingService] Scraper returned ${listings.length} listings`);

                    const matchingService = new MatchingService();
                    let addedCount = 0;
                    const processingErrors: string[] = [];

                    for (const listing of listings) {
                        try {
                            const sellerId = await this.getOrCreateSeller(listing.sellerName, listing.sellerType);

                            // Check for existing property (deduplication)
                            const existing = await prisma.property.findFirst({
                                where: {
                                    title: listing.title,
                                    locality: listing.locality,
                                    sellerId: sellerId
                                }
                            });

                            if (existing) {
                                console.log(`[ScrapingService] Skipping existing property: ${listing.title}`);
                                continue;
                            }

                            const newProperty = await PropertyService.createProperty({
                                sellerId: sellerId,
                                title: listing.title,
                                locality: listing.locality,
                                address: listing.locality,
                                area: listing.area,
                                bhk: listing.bhk,
                                price: listing.price,
                                amenities: listing.amenities,
                                propertyType: listing.propertyType,
                                description: listing.description,
                                metadata: {
                                    sourceUrl: listing.sourceUrl,
                                    externalId: listing.externalId,
                                    source: listing.source,
                                    scraper: scraper,
                                    ownerName: listing.ownerName,
                                    companyName: listing.companyName,
                                    imageUrl: listing.imageUrl,
                                    landmark: listing.landmark,
                                    postedDate: listing.postedDate,
                                    scrapedAt: new Date().toISOString()
                                }
                            });
                            console.log(`[ScrapingService] Successfully added property: ${newProperty.title} (ID: ${newProperty.id})`);
                            addedCount++;

                            // --- AUTO-MATCHING & LEAD CREATION ---
                            try {
                                const matches = await matchingService.findMatchesForProperty(newProperty.id);
                                console.log(`[ScrapingService] Generated ${matches.length} matches for "${newProperty.title}"`);

                                for (const match of matches) {
                                    if (match.matchScore >= 70) {
                                        await LeadService.createLead({
                                            buyerId: match.buyerId,
                                            propertyId: newProperty.id,
                                            matchScore: match.matchScore,
                                            metadata: {
                                                source: 'auto-scraper',
                                                scraper: scraper,
                                                autoCreated: true
                                            }
                                        });
                                        console.log(`[ScrapingService] Auto-created LEAD for Buyer ${match.buyerId}`);
                                    }
                                }
                            } catch (matchErr: any) {
                                console.error(`[ScrapingService] Matching failed for property ${newProperty.id}:`, matchErr.message);
                            }
                            // -------------------------------------

                        } catch (err: any) {
                            console.error(`[ScrapingService] Error saving property ${listing.title}:`, err);
                            processingErrors.push(`Failed to save ${listing.title}: ${err.message}`);
                        }
                    }

                    resolve({ added: addedCount, errors: processingErrors });

                } catch (err: any) {
                    console.error(`[ScrapingService] Failed to parse JSON: ${err.message}`);
                    reject(new Error('Invalid JSON output from scraper'));
                }
            });
        });
    }
}
