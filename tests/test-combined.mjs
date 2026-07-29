// Test combined Overpass query to fetch Airport, Bus, Train, Hospital at once
const LAT = 19.0176;
const LON = 72.8562;
const OVERPASS = 'https://overpass-api.de/api/interpreter';

// For localized amenities (hospital, bus, train) we use a 5km radius (0.05 deg approx)
// For airports, we use an 80km radius (0.8 deg approx)
async function testCombinedQuery() {
    console.log(`Testing combined query for Mumbai (${LAT}, ${LON})`);

    // We can use the around: filter inside a union.
    // This allows different radii per tag, all in ONE single request!

    const ql = `[out:json][timeout:25];
(
  // Airport (large radius - 80km)
  node["aeroway"="aerodrome"](around:80000,${LAT},${LON});
  way["aeroway"="aerodrome"](around:80000,${LAT},${LON});
  
  // Train/Metro (5km)
  node["railway"="station"](around:5000,${LAT},${LON});
  node["railway"="halt"](around:5000,${LAT},${LON});
  
  // Bus (5km)
  node["amenity"="bus_station"](around:5000,${LAT},${LON});
  way["amenity"="bus_station"](around:5000,${LAT},${LON});
  
  // Hospital (5km)
  node["amenity"="hospital"](around:5000,${LAT},${LON});
  way["amenity"="hospital"](around:5000,${LAT},${LON});
);
out center;`;

    console.log(ql);

    try {
        const r = await fetch(OVERPASS, {
            method: 'POST',
            body: `data=${encodeURIComponent(ql)}`,
            signal: AbortSignal.timeout(30_000)
        });

        if (!r.ok) {
            console.error('Overpass HTTP ' + r.status + ':\n' + (await r.text()));
            return;
        }

        const data = await r.json();
        console.log(`Total results: ${data.elements?.length || 0}`);

        // Group them
        if (data.elements) {
            data.elements.forEach(el => {
                const name = el.tags?.name || el.tags?.['name:en'] || el.tags?.ref || 'Unknown';
                const type = Object.keys(el.tags || {}).find(k => ['aeroway', 'railway', 'amenity'].includes(k));
                const val = type ? el.tags[type] : '?';
                console.log(`- ${type}=${val}: ${name}`);
            });
        }

    } catch (err) {
        console.error('Fetch error:', err.message);
    }
}

testCombinedQuery().catch(console.error);
