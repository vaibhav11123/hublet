/**
 * Haversine distance calculator.
 * Computes the great-circle distance between two lat/lon points on Earth.
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the distance in kilometers between two geographic points.
 */
export function haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/**
 * Convert a distance in km to a location match score (0–100).
 * Implements a strict geographical multi-segment decay curve.
 */
export function distanceToScore(dist: number): number {
    if (dist <= 1.5) return 100;
    if (dist <= 2.5) return 100 - ((dist - 1.5) / 1.0) * 5;     // 1.5->100, 2.5->95
    if (dist <= 3.0) return 95 - ((dist - 2.5) / 0.5) * 5;      // 2.5->95, 3.0->90
    if (dist <= 4.0) return 90 - ((dist - 3.0) / 1.0) * 10;     // 3.0->90, 4.0->80
    if (dist <= 5.0) return 80 - ((dist - 4.0) / 1.0) * 5;      // 4.0->80, 5.0->75
    if (dist <= 6.5) return 75 - ((dist - 5.0) / 1.5) * 10;     // 5.0->75, 6.5->65
    if (dist <= 8.0) return 65 - ((dist - 6.5) / 1.5) * 5;      // 6.5->65, 8.0->60
    if (dist <= 10.0) return 60 - ((dist - 8.0) / 2.0) * 10;    // 8.0->60, 10.0->50
    if (dist <= 12.0) return 50 - ((dist - 10.0) / 2.0) * 5;    // 10.0->50, 12.0->45
    if (dist <= 15.0) return 45 - ((dist - 12.0) / 3.0) * 5;    // 12.0->45, 15.0->40
    if (dist <= 25.0) return 40 - ((dist - 15.0) / 10.0) * 40;  // 15.0->40, 25.0->0
    return 0;
}
