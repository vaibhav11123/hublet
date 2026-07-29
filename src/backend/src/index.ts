import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';
import buyerRoutes from './routes/buyer.routes';
import sellerRoutes from './routes/seller.routes';
import propertyRoutes from './routes/property.routes';
import leadRoutes from './routes/lead.routes';
import matchingRoutes from './routes/matching.routes';
import workflowEventRoutes from './routes/workflow-event.routes';
import authRoutes from './routes/auth.routes';
import seedRoutes from './routes/seed.routes';
import notificationRoutes from './routes/notification.routes';
import analyticsRoutes from './routes/analytics.routes';
import { authenticateJwt, requireRoles } from './middleware/auth.middleware';
import { sanitizeResponsePayload } from './utils/response-sanitizer';

// Load environment variables
dotenv.config();

// Ensure Python environment is setup and dependencies installed before starting
import * as fs from 'fs';
import { execSync } from 'child_process';
(function setupPythonEnv() {
    try {
        const isWin = process.platform === 'win32';
        const venvDir = path.join(process.cwd(), '.venv');
        const py = isWin ? 'python' : 'python3';
        const pip = path.join(venvDir, isWin ? 'Scripts' : 'bin', 'pip');
        const req = path.join(process.cwd(), 'scraper', 'requirements.txt');
        
        if (!fs.existsSync(venvDir)) {
            console.log(`[Startup] Building Python virtual environment...`);
            execSync(`${py} -m venv .venv`, { stdio: 'inherit' });
        }
        
        console.log(`[Startup] Verifying Python requirements from ${req}...`);
        execSync(`${pip} install -r "${req}"`, { stdio: 'inherit' });

        const fbReq = path.join(process.cwd(), 'scraper', 'facebook_group_scraper', 'requirements.txt');
        if (fs.existsSync(fbReq)) {
            console.log(`[Startup] Verifying Facebook Scraper requirements from ${fbReq}...`);
            execSync(`${pip} install -r "${fbReq}"`, { stdio: 'inherit' });
        }
    } catch (err: any) {
        console.error(`[Startup] Failed to setup python virtual environment automatically:`, err.message);
    }
})();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS — allow origins from env, comma-separated, fallback to localhost for dev.
// Each entry can be:
//   - an exact origin:  https://dass-hublet-frontend.vercel.app
//   - a wildcard glob:  *.vercel.app  (matches all Vercel preview deployments)
//   - a bare wildcard:  *             (allow all — dev only)
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

/** Returns true if `origin` matches an allowed entry (exact or *.domain glob). */
function isOriginAllowed(origin: string): boolean {
    for (const allowed of ALLOWED_ORIGINS) {
        if (allowed === '*') return true;
        if (allowed === origin) return true;
        // Wildcard prefix: *.example.com matches anything.example.com (http or https)
        if (allowed.startsWith('*.')) {
            const suffix = allowed.slice(1); // e.g. ".vercel.app"
            try {
                const { hostname } = new URL(origin);
                if (hostname.endsWith(suffix)) return true;
            } catch { /* invalid URL, skip */ }
        }
    }
    return false;
}

// Middleware
app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (curl, Render health checks, mobile apps, etc.)
            if (!origin) return callback(null, true);
            if (isOriginAllowed(origin)) return callback(null, true);
            return callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => originalJson(sanitizeResponsePayload(body))) as typeof res.json;
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Hublet API is running' });
});

// Public authentication routes
app.use('/api/auth', authRoutes);

// Python environment debug endpoint — outside /api so JWT middleware doesn't apply
app.get('/debug-python', (req, res) => {
    const results: Record<string, string> = {};

    const run = (cmd: string) => {
        try { return execSync(cmd, { timeout: 5000 }).toString().trim(); }
        catch (e: any) { return `ERROR: ${e.message}`; }
    };

    const scraperDir = path.join(process.cwd(), 'scraper');
    const localVenvPosix = path.join(process.cwd(), '.venv', 'bin', 'python');
    const venvPythonPosix = path.join(scraperDir, 'venv', 'bin', 'python');
    const venvPythonWindows = path.join(scraperDir, 'venv', 'Scripts', 'python.exe');
    let resolvedPython = process.platform === 'win32' ? 'python' : 'python3';
    if (fs.existsSync(localVenvPosix)) resolvedPython = localVenvPosix;
    else if (fs.existsSync(venvPythonPosix)) resolvedPython = venvPythonPosix;
    else if (fs.existsSync(venvPythonWindows)) resolvedPython = venvPythonWindows;
    else if (process.env.PYTHON_PATH) resolvedPython = process.env.PYTHON_PATH;

    const venvPython = process.platform === 'win32' ? venvPythonWindows : venvPythonPosix;

    results['__dirname'] = __dirname;
    results['process_cwd'] = process.cwd();
    results['PYTHON_PATH_env'] = process.env.PYTHON_PATH || '(not set)';
    results['resolved_python'] = resolvedPython;
    results['venv_python_exists'] = fs.existsSync(venvPython) ? 'YES' : 'NO';
    results['venv_python_path'] = venvPython;
    results['scraper_dir'] = scraperDir;
    results['scraper_dir_exists'] = fs.existsSync(scraperDir) ? 'YES' : 'NO';
    results['scraper_py_exists'] = fs.existsSync(path.join(scraperDir, 'scraper.py')) ? 'YES' : 'NO';
    results['which_python3'] = run('which python3');
    results['python3_version'] = run('python3 --version');
    results['requests_check'] = run(`${resolvedPython} -c "import requests; print('requests OK:', requests.__version__)"`);
    results['sys_path'] = run(`${resolvedPython} -c "import sys; print(sys.path)"`);

    res.json(results);
});

// All other /api routes are protected by JWT
app.use('/api', authenticateJwt);

// Scheduler
import { setupScheduler, runManualScrape } from './cron/scheduler';
import { ScrapingService } from './services/scraping.service';
import { exportUsersList } from './utils/export-users';
setupScheduler();

// List available scrapers
app.get('/api/admin/scrapers', requireRoles('admin'), async (req, res) => {
    try {
        const scrapers = await ScrapingService.listScrapers();
        res.json({ success: true, scrapers });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin scraping trigger
app.post('/api/admin/trigger-scrape', requireRoles('admin'), async (req, res) => {
    const { city, scraper } = req.body;
    try {
        const results = await runManualScrape(city, scraper);
        // Auto-export users list after scrape
        try { await exportUsersList(); } catch (e) { /* ignore */ }
        res.json({ success: true, results });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API Routes
app.use('/api/buyers', buyerRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/matches', matchingRoutes);
app.use('/api/workflow-events', workflowEventRoutes);
app.use('/api/admin/seed', seedRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

// ── Facebook Group Scraper ────────────────────────────────────────────────
import csv from 'csv-parser';
import { PropertyService } from './services/property.service';
import { MatchingService } from './services/matching.service';
import { LeadService } from './services/lead.service';
import { logCredential } from './utils/credential-logger';
import { GeocodeService } from './services/geocode.service';

const FB_SCRAPER_DIR = path.join(__dirname, '../scraper/facebook_group_scraper');
const localVenvPosixFb = path.join(process.cwd(), '.venv', 'bin', 'python');
const localVenvWindowsFb = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
const fbVenvPythonPosix = path.join(FB_SCRAPER_DIR, 'venv', 'bin', 'python');
const fbVenvPythonWindows = path.join(FB_SCRAPER_DIR, 'venv', 'Scripts', 'python.exe');
const FB_PYTHON = fs.existsSync(localVenvPosixFb) ? localVenvPosixFb
    : fs.existsSync(localVenvWindowsFb) ? localVenvWindowsFb
    : fs.existsSync(fbVenvPythonPosix) ? fbVenvPythonPosix
    : fs.existsSync(fbVenvPythonWindows) ? fbVenvPythonWindows
    : (process.platform === 'win32' ? 'python' : 'python3');
const FB_SCRIPT = path.join(FB_SCRAPER_DIR, 'pipeline.py');

// Trigger Facebook group scrape
app.post('/api/admin/fb-scrape', async (req, res) => {
    const { groupUrl } = req.body;
    if (!groupUrl) {
        return res.status(400).json({ success: false, error: 'groupUrl is required' });
    }

    try {
        // 1. Clear data directory
        const dataDir = path.join(FB_SCRAPER_DIR, 'data');
        if (fs.existsSync(dataDir)) {
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
        fs.mkdirSync(dataDir, { recursive: true });

        // 2. Write groupUrl to groups.txt
        const groupsFile = path.join(FB_SCRAPER_DIR, 'groups.txt');
        fs.writeFileSync(groupsFile, groupUrl, 'utf8');

        // 3. Run pipeline.py
        await new Promise((resolve, reject) => {
            const proc = spawn(FB_PYTHON, [
                FB_SCRIPT
            ], { cwd: FB_SCRAPER_DIR });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
            proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

            proc.on('close', (code: number) => {
                if (stdout) console.log(`[FB-Scrape] stdout:\n${stdout}`);
                if (stderr) console.error(`[FB-Scrape] stderr:\n${stderr}`);

                if (code !== 0) {
                    return reject(new Error(`Facebook scraper exited with code ${code}: ${stderr.slice(-500)}`));
                }
                resolve(true);
            });
        });

        // 4. Load extracted_listings.csv and return it
        const csvPath = path.join(FB_SCRAPER_DIR, 'data/extracted_listings.csv');
        if (!fs.existsSync(csvPath)) {
            return res.status(500).json({ success: false, error: 'Scraping finished but extracted_listings.csv not found.' });
        }

        const results: any[] = [];
        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                res.json({ success: true, data: results });
            })
            .on('error', (error) => {
                res.status(500).json({ success: false, error: 'Failed to parse CSV file: ' + error.message });
            });

    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Load locally saved extracted_listings.csv
app.get('/api/admin/fb-load-csv', async (req, res) => {
    const csvPath = path.join(FB_SCRAPER_DIR, 'data/extracted_listings.csv');

    if (!fs.existsSync(csvPath)) {
        return res.status(404).json({ success: false, error: 'extracted_listings.csv not found. Run the python scraper first.' });
    }

    const results: any[] = [];
    fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            res.json({ success: true, data: results });
        })
        .on('error', (error) => {
            res.status(500).json({ success: false, error: 'Failed to parse CSV file: ' + error.message });
        });
});

// Save curated Facebook scrape results to the DB
app.post('/api/admin/fb-save', async (req, res) => {
    const { rows } = req.body; // array of scraped row objects
    if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ success: false, error: 'rows array is required' });
    }

    let saved = 0;
    const errors: string[] = [];
    const matchingService = new MatchingService();

    for (const row of rows) {
        try {
            // Create a seller placeholder if needed
            const sellerName = row.SELLER && row.SELLER !== '-' ? row.SELLER : 'Facebook Group Seller';
            const prisma = (await import('./db/prisma')).default;

            const safeName = sellerName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const email = `${safeName}@hublet.fb`;

            let seller = await prisma.seller.findUnique({ where: { email } });
            if (!seller) {
                seller = await prisma.seller.create({
                    data: {
                        name: sellerName,
                        email: email,
                        phone: row.CONTACT && row.CONTACT !== '-' ? row.CONTACT : '0000000000',
                        sellerType: 'owner',
                        rating: 3.0,
                        completedDeals: 0,
                    }
                });
                logCredential({ role: 'seller', name: sellerName, email, password: '(facebook-no-password)', source: 'facebook' });
            }

            const title = row.TITLE && row.TITLE !== '-' ? row.TITLE : 'Facebook Listing';
            const locality = row.LOCALITY && row.LOCALITY !== '-' ? row.LOCALITY : 'Unknown';

            // Check for existing property (deduplication)
            const existing = await prisma.property.findFirst({
                where: {
                    title: title,
                    locality: locality,
                    sellerId: seller.id
                }
            });

            if (existing) {
                console.log(`[FB-Save] Skipping existing property: ${title}`);
                continue;
            }

            // Parse price
            let price = 0;
            if (row.PRICE && row.PRICE !== '-') {
                const parsed = parseFloat(String(row.PRICE).replace(/[^0-9.]/g, ''));
                if (!isNaN(parsed)) price = parsed;
            }

            // Parse area
            let area = 0;
            if (row.AREA && row.AREA !== '-') {
                const parsed = parseInt(String(row.AREA).replace(/[^0-9]/g, ''));
                if (!isNaN(parsed)) area = parsed;
            }

            // Parse bhk
            let bhk = 0;
            if (row.BHK && row.BHK !== '-') {
                const parsed = parseInt(String(row.BHK));
                if (!isNaN(parsed)) bhk = parsed;
            }

            // Parse amenities
            let amenities: string[] = [];
            if (row.AMENITIES && row.AMENITIES !== '-') {
                amenities = String(row.AMENITIES).split(',').map((a: string) => a.trim()).filter((a: string) => a.length > 0);
            }

            const newProperty = await PropertyService.createProperty({
                sellerId: seller.id,
                title: title,
                locality: locality,
                area: area,
                bhk: bhk,
                price: price,
                amenities: amenities,
                propertyType: row.TYPE && row.TYPE !== '-' ? row.TYPE.toLowerCase() : 'apartment',
                contact: row.CONTACT && row.CONTACT !== '-' ? row.CONTACT : undefined,
                metadata: {
                    source: 'facebook-group',
                    scraper: 'facebook_group_scraper',
                    groupUrl: row.GROUP_URL || '-',
                    postedDate: row.CREATED_AT || '-',
                    status: row.STATUS || '-',
                    scrapedAt: new Date().toISOString()
                },
            });

            // Auto-geocode the property if no coordinates in metadata
            try {
                const propMeta = newProperty.metadata ? JSON.parse(newProperty.metadata) : {};
                if (!propMeta.coordinates && locality !== 'Unknown') {
                    const coords = await GeocodeService.geocodeAddress(locality);
                    if (coords) {
                        propMeta.coordinates = coords;
                        await prisma.property.update({ where: { id: newProperty.id }, data: { metadata: JSON.stringify(propMeta) } });
                        console.log(`[FB-Save] Geocoded "${locality}" → ${coords.lat}, ${coords.lon}`);
                    }
                }
            } catch (geoErr: any) {
                console.warn(`[FB-Save] Geocoding failed for "${locality}":`, geoErr.message);
            }

            saved++;

            // --- AUTO-MATCHING & LEAD CREATION ---
            try {
                const matches = await matchingService.findMatchesForProperty(newProperty.id);
                console.log(`[FB-Save] Generated ${matches.length} matches for "${newProperty.title}"`);

                for (const match of matches) {
                    if (match.matchScore >= 70) {
                        await LeadService.createLead({
                            buyerId: match.buyerId,
                            propertyId: newProperty.id,
                            matchScore: match.matchScore,
                            metadata: {
                                source: 'facebook-group',
                                scraper: 'facebook_group_scraper',
                                autoCreated: true
                            }
                        });
                        console.log(`[FB-Save] Auto-created LEAD for Buyer ${match.buyerId}`);
                    }
                }
            } catch (matchErr: any) {
                console.error(`[FB-Save] Matching failed for property ${newProperty.id}:`, matchErr.message);
            }
            // -------------------------------------

        } catch (err: any) {
            errors.push(`${row.TITLE || 'unknown'}: ${err.message}`);
        }
    }

    res.json({ success: true, saved, errors });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, async () => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    console.log(` Hublet API server running on port ${PORT}`);
    console.log(` Health check: ${baseUrl}/health`);
    console.log(`️  Default scraper: ${process.env.SCRAPER || 'magicbricks-direct'}`);
    console.log(` Allowed CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);

    // Export users list on startup
    try {
        await exportUsersList();
        console.log(' Users list exported to users_list.md');
    } catch (e) { /* db might be empty */ }

    console.log('\n  To trigger a scrape:');
    console.log(`  curl -X POST ${baseUrl}/api/admin/trigger-scrape \\`);
    console.log('    -H "Content-Type: application/json" \\');
    console.log('    -d \'{"city": "pune", "scraper": "99acres-apify"}\'');
    console.log(`\n  To list scrapers: curl ${baseUrl}/api/admin/scrapers\n`);
});

export default app;
