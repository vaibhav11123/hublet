import { fetchNearbyPlaces } from './src/utils/nearby-places';

async function main() {
    console.log('Testing Mumbai (Antop Hill: 19.0176, 72.8562)...\n');
    const r = await fetchNearbyPlaces(19.0176, 72.8562);
    console.log('\n=== Results ===');
    console.log('Airport:     ', r.airport ? `${r.airport.name} (${r.airport.distanceKm} km)` : 'NOT FOUND');
    console.log('Bus:         ', r.busStation ? `${r.busStation.name} (${r.busStation.distanceKm} km)` : 'NOT FOUND');
    console.log('Train/Metro: ', r.trainStation ? `${r.trainStation.name} (${r.trainStation.distanceKm} km)` : 'NOT FOUND');
    console.log('Hospital:    ', r.hospital ? `${r.hospital.name} (${r.hospital.distanceKm} km)` : 'NOT FOUND');
}

main().catch(console.error);
