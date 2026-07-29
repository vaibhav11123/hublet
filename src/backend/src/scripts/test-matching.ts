/**
 * test-matching.ts
 *
 * End-to-end matching validation script.
 * Seeds data, runs matching for all buyers, and produces a test report.
 *
 * Usage: npx tsx src/scripts/test-matching.ts
 */

import prisma from '../db/prisma';
import { MatchingService } from '../services/matching.service';

const matchingService = new MatchingService();

interface TestResult {
    buyerName: string;
    buyerCity: string;
    matchCount: number;
    matches: Array<{
        propertyTitle: string;
        propertyLocality: string;
        propertyCity: string;
        totalScore: number;
        locationScore: number;
        budgetScore: number;
        sizeScore: number;
        amenitiesScore: number;
        sameCityMatch: boolean;
    }>;
}

async function run() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  GEO-ONLY MATCHING TEST REPORT');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Get all buyers and properties
    const buyers = await prisma.buyer.findMany({ orderBy: { createdAt: 'asc' } });
    const properties = await prisma.property.findMany({ include: { seller: true } });

    console.log(`📊 Dataset: ${buyers.length} buyers, ${properties.length} properties\n`);

    // Build city lookup for properties
    const propertyCityMap = new Map<string, string>();
    for (const p of properties) {
        try {
            const meta = p.metadata ? JSON.parse(p.metadata) : {};
            // Infer city from locality string
            const locality = p.locality.toLowerCase();
            if (locality.includes('hyderabad')) propertyCityMap.set(p.id, 'Hyderabad');
            else if (locality.includes('bangalore') || locality.includes('bengaluru')) propertyCityMap.set(p.id, 'Bangalore');
            else if (locality.includes('mumbai') || locality.includes('thane')) propertyCityMap.set(p.id, 'Mumbai');
            else if (locality.includes('pune')) propertyCityMap.set(p.id, 'Pune');
            else if (locality.includes('chennai')) propertyCityMap.set(p.id, 'Chennai');
            else propertyCityMap.set(p.id, 'Unknown');
        } catch { propertyCityMap.set(p.id, 'Unknown'); }
    }

    const allResults: TestResult[] = [];
    let totalMatches = 0;
    let sameCityMatches = 0;
    let crossCityMatches = 0;

    // Run matching for each buyer
    for (const buyer of buyers) {
        const buyerMeta = buyer.metadata ? JSON.parse(buyer.metadata) : {};
        const buyerCity = buyerMeta.city || 'Unknown';

        try {
            const matches = await matchingService.findMatchesForBuyer(buyer.id, { minScore: 0.1 });

            const testResult: TestResult = {
                buyerName: buyer.name,
                buyerCity,
                matchCount: matches.length,
                matches: [],
            };

            for (const m of matches) {
                const propCity = propertyCityMap.get(m.property?.id || (m as any).propertyId) || 'Unknown';
                const isSameCity = buyerCity === propCity;

                if (isSameCity) sameCityMatches++;
                else crossCityMatches++;
                totalMatches++;

                testResult.matches.push({
                    propertyTitle: m.property?.title || '?',
                    propertyLocality: m.property?.locality || '?',
                    propertyCity: propCity,
                    totalScore: (m as any).matchScore,
                    locationScore: (m as any).locationScore ?? 0,
                    budgetScore: (m as any).budgetScore ?? 0,
                    sizeScore: (m as any).sizeScore ?? 0,
                    amenitiesScore: (m as any).amenitiesScore ?? 0,
                    sameCityMatch: isSameCity,
                });
            }

            allResults.push(testResult);
        } catch (err: any) {
            console.error(`  ✗ Error matching buyer ${buyer.name}: ${err.message}`);
        }
    }

    // ─── Print Results ────────────────────────────────────────────────

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  DETAILED RESULTS');
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const r of allResults) {
        console.log(`┌─ ${r.buyerName} (${r.buyerCity}) — ${r.matchCount} match(es)`);
        if (r.matches.length === 0) {
            console.log('│  No matches found');
        }
        // Show top 5 matches
        for (const m of r.matches.slice(0, 5)) {
            const cityTag = m.sameCityMatch ? '✅ SAME-CITY' : '❌ CROSS-CITY';
            console.log(`│  ${cityTag} | Total: ${m.totalScore.toFixed(1)}% | Loc: ${m.locationScore.toFixed(1)}% | Bud: ${m.budgetScore.toFixed(1)}% | Sz: ${m.sizeScore.toFixed(1)}% | Am: ${m.amenitiesScore.toFixed(1)}%`);
            console.log(`│         ${m.propertyTitle} (${m.propertyLocality})`);
        }
        if (r.matches.length > 5) {
            console.log(`│  ... and ${r.matches.length - 5} more`);
        }
        console.log('└──────────────────────────────────────────────────────');
    }

    // ─── Summary stats ─────────────────────────────────────────────

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Total buyers tested:        ${buyers.length}`);
    console.log(`Total properties:           ${properties.length}`);
    console.log(`Total matches generated:    ${totalMatches}`);
    console.log(`  Same-city matches:        ${sameCityMatches}`);
    console.log(`  Cross-city matches:       ${crossCityMatches}`);
    console.log(`  Cross-city rate:          ${totalMatches > 0 ? ((crossCityMatches / totalMatches) * 100).toFixed(1) : 0}%`);

    // Buyer-level stats
    const buyersWithMatches = allResults.filter(r => r.matchCount > 0).length;
    const buyersWithoutMatches = allResults.filter(r => r.matchCount === 0).length;
    console.log(`\n  Buyers WITH matches:      ${buyersWithMatches}`);
    console.log(`  Buyers WITHOUT matches:   ${buyersWithoutMatches}`);

    // Score distribution
    const allScores = allResults.flatMap(r => r.matches.map(m => m.totalScore));
    const allLocScores = allResults.flatMap(r => r.matches.map(m => m.locationScore));

    if (allScores.length > 0) {
        const avgTotal = allScores.reduce((a, b) => a + b, 0) / allScores.length;
        const avgLoc = allLocScores.reduce((a, b) => a + b, 0) / allLocScores.length;
        const maxTotal = Math.max(...allScores);
        const minTotal = Math.min(...allScores);

        console.log(`\n  Avg total score:          ${avgTotal.toFixed(1)}%`);
        console.log(`  Avg location score:       ${avgLoc.toFixed(1)}%`);
        console.log(`  Score range:              ${minTotal.toFixed(1)}% – ${maxTotal.toFixed(1)}%`);
    }

    // ─── Test Assertions ───────────────────────────────────────────

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  TEST ASSERTIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    function assert(name: string, condition: boolean, detail: string) {
        if (condition) {
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } else {
            console.log(`  ❌ FAIL: ${name} — ${detail}`);
            failed++;
        }
    }

    assert(
        'No cross-city matches exist',
        crossCityMatches === 0,
        `Found ${crossCityMatches} cross-city match(es). The 25% threshold should filter them all.`
    );

    assert(
        'All matches have totalScore >= minScore threshold',
        allScores.every(s => s >= 0.1),
        `Some matches had totalScore < 0.1`
    );

    assert(
        'All same-city matches have locationScore >= 25',
        allResults.flatMap(r => r.matches.filter(m => m.sameCityMatch)).every(m => m.locationScore >= 25),
        `Some same-city matches had locationScore < 25`
    );

    // Check that nearby matches (same locality) get high location scores
    const highLocScores = allResults.flatMap(r => r.matches.filter(m => m.locationScore >= 90));
    assert(
        'At least some matches have locationScore >= 90 (very close proximity)',
        highLocScores.length > 0,
        `No matches had locationScore >= 90. Nearest matches may have data issues.`
    );

    assert(
        'Majority of buyers found at least one match',
        buyersWithMatches / buyers.length >= 0.5,
        `Only ${buyersWithMatches}/${buyers.length} buyers had matches`
    );

    console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

    await prisma.$disconnect();
}

run().catch(console.error);
