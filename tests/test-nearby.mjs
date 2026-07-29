// Quick test of the new Nominatim-based nearby-places logic for Antop Hill, Mumbai
import { fetchNearbyPlaces } from './src/backend/src/utils/nearby-places.js';

(async () => {
    console.log('Testing nearby places for Antop Hill, Mumbai (19.0176, 72.8562)...\n');
    try {
        const result = await fetchNearbyPlaces(19.0176, 72.8562);
        console.log('\nResult:');
        console.log('Airport:     ', result.airport?.name, result.airport?.distanceKm ? `(${result.airport.distanceKm} km)` : '❌ not found');
        console.log('Bus:         ', result.busStation?.name, result.busStation?.distanceKm ? `(${result.busStation.distanceKm} km)` : '❌ not found');
        console.log('Train/Metro: ', result.trainStation?.name, result.trainStation?.distanceKm ? `(${result.trainStation.distanceKm} km)` : '❌ not found');
        console.log('Hospital:    ', result.hospital?.name, result.hospital?.distanceKm ? `(${result.hospital.distanceKm} km)` : '❌ not found');
    } catch (e) {
        console.error('Error:', e);
    }
})();
