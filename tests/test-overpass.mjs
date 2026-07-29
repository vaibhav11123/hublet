// Test Nominatim search API for Mumbai POIs — no rate-limiting issues
// Antop Hill, Mumbai: lat=19.0176, lon=72.8562

const LAT = 19.0176;
const LON = 72.8562;
const UA = 'hublet-realestate/1.0 (contact@hublet.demo)';

async function nominatimSearch(category, q) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=in&viewbox=${LON - 0.5},${LAT + 0.5},${LON + 0.5},${LAT - 0.5}&bounded=0`;
    try {
        const r = await fetch(url, { headers: { 'User-Agent': UA } });
        const d = await r.json();
        console.log(`[nominatim][${category}] ${d.length} results`);
        if (d.length > 0) console.log(`  Best: "${d[0].display_name.split(',')[0]}" type=${d[0].type} class=${d[0].class}`);
        return d;
    } catch (e) { console.log(`[nominatim][${category}] ERROR: ${e.message}`); return []; }
}

async function nominatimNearby(category, amenity, radius = 5000) {
    // Use Nominatim nearby search
    const url = `https://nominatim.openstreetmap.org/search?amenity=${amenity}&format=json&limit=5&countrycodes=in`;
    try {
        const r = await fetch(url, { headers: { 'User-Agent': UA } });
        const d = await r.json();
        // filter by distance manually
        const nearby = d.filter(e => {
            const dlat = (parseFloat(e.lat) - LAT), dlon = (parseFloat(e.lon) - LON);
            return Math.sqrt(dlat * dlat + dlon * dlon) * 111 < radius / 1000;
        });
        console.log(`[nominatim-amenity][${category}] ${nearby.length} within ${radius / 1000}km of ${d.length} total`);
        if (nearby.length > 0) console.log(`  Best: "${nearby[0].display_name.split(',')[0]}"`);
    } catch (e) { console.log(`[nominatim-amenity][${category}] ERROR: ${e.message}`); }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Also test small-bbox Overpass (much faster than radius)
async function overpassBbox(label, ql) {
    const url = 'https://overpass-api.de/api/interpreter';
    try {
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
            body: `data=${encodeURIComponent(ql)}`,
            signal: AbortSignal.timeout(15000),
        });
        const text = await r.text();
        if (!r.ok) { console.log(`[overpass-bbox][${label}] HTTP ${r.status}`); return; }
        const d = JSON.parse(text);
        console.log(`[overpass-bbox][${label}] ${d.elements?.length ?? 0} results`);
        if (d.elements?.length > 0) {
            const e = d.elements[0];
            console.log(`  Best: "${e.tags?.name || '?'}" type=${e.type}`);
        }
    } catch (e) { console.log(`[overpass-bbox][${label}] ERROR: ${e.message}`); }
}

(async () => {
    console.log('=== Nominatim text search ===');
    await nominatimSearch('airport', 'Mumbai airport');
    await sleep(1100);
    await nominatimSearch('bus_station', 'Antop Hill bus station Mumbai');
    await sleep(1100);
    await nominatimSearch('railway', 'Antop Hill railway station Mumbai');
    await sleep(1100);
    await nominatimSearch('hospital', 'hospital Antop Hill Mumbai');
    await sleep(1100);

    // Small bounding box — 0.1 degree = ~11km, much faster query
    console.log('\n=== Overpass small bbox (0.15 deg) ===');
    const b = `${LAT - 0.15},${LON - 0.15},${LAT + 0.15},${LON + 0.15}`;
    await overpassBbox('airport', `[out:json][timeout:15];(node["aeroway"="aerodrome"](${b});way["aeroway"="aerodrome"](${b}););out center 5;`);
    await sleep(500);
    await overpassBbox('bus_station', `[out:json][timeout:15];(node["amenity"="bus_station"](${b});way["amenity"="bus_station"](${b}););out center 5;`);
    await sleep(500);
    await overpassBbox('railway', `[out:json][timeout:15];(node["railway"="station"](${b});way["railway"="station"](${b}););out center 5;`);
    await sleep(500);
    await overpassBbox('hospital', `[out:json][timeout:15];(node["amenity"="hospital"](${b});way["amenity"="hospital"](${b}););out center 5;`);

    console.log('\nDone.');
})();
