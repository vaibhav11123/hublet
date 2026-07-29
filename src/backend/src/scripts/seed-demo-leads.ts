/**
 * seed-demo-leads.ts
 *
 * Converts existing high-score Matches into Leads (mirroring the >=70 threshold
 * used by the real scraper pipeline in scraping.service.ts), then advances a
 * realistic distribution of them through the real state machine via
 * LeadService.transitionState — so pipeline/conversion charts show a genuine
 * funnel shape instead of either all-zero or all-NEW.
 */

import { PrismaClient } from '@prisma/client';
import { LeadService } from '../services/lead.service';
import { LeadState } from '../workflows/state-machine';

const MATCH_SCORE_THRESHOLD = 70;

// Funnel-shaped distribution: most leads drop off early, a smaller share closes.
// Each entry is the final state a lead should be advanced to.
const STATE_DISTRIBUTION: Array<{ state: LeadState; weight: number }> = [
    { state: LeadState.NEW, weight: 0.30 },
    { state: LeadState.ENRICHED, weight: 0.20 },
    { state: LeadState.QUALIFIED, weight: 0.15 },
    { state: LeadState.NOTIFIED, weight: 0.15 },
    { state: LeadState.CONTACTED, weight: 0.10 },
    { state: LeadState.CLOSED, weight: 0.10 },
];

const STATE_ORDER = [
    LeadState.NEW,
    LeadState.ENRICHED,
    LeadState.QUALIFIED,
    LeadState.NOTIFIED,
    LeadState.CONTACTED,
    LeadState.CLOSED,
];

function pickTargetState(): LeadState {
    const r = Math.random();
    let cumulative = 0;
    for (const entry of STATE_DISTRIBUTION) {
        cumulative += entry.weight;
        if (r <= cumulative) return entry.state;
    }
    return LeadState.NEW;
}

export async function seedDemoLeads(prisma: PrismaClient): Promise<{
    created: number;
    skipped: number;
    distribution: Record<string, number>;
}> {
    const qualifyingMatches = await prisma.match.findMany({
        where: { matchScore: { gte: MATCH_SCORE_THRESHOLD } },
    });

    const existingLeads = await prisma.lead.findMany({
        select: { buyerId: true, propertyId: true },
    });
    const existingPairs = new Set(existingLeads.map((l) => `${l.buyerId}::${l.propertyId}`));

    let created = 0;
    let skipped = 0;
    const distribution: Record<string, number> = {};
    for (const state of STATE_ORDER) distribution[state] = 0;

    for (const match of qualifyingMatches) {
        const pairKey = `${match.buyerId}::${match.propertyId}`;
        if (existingPairs.has(pairKey)) {
            skipped++;
            continue;
        }

        const lead = await LeadService.createLead({
            buyerId: match.buyerId,
            propertyId: match.propertyId,
            matchScore: match.matchScore,
            metadata: { source: 'demo-seeder' },
        });

        const targetState = pickTargetState();
        const targetIndex = STATE_ORDER.indexOf(targetState);

        // Walk the state machine one step at a time up to the target state.
        for (let i = 1; i <= targetIndex; i++) {
            await LeadService.transitionState(lead.id, STATE_ORDER[i]);
        }

        distribution[targetState]++;
        created++;
        existingPairs.add(pairKey);
    }

    console.log(`[seed-demo-leads] Created ${created} leads from ${qualifyingMatches.length} qualifying matches, skipped ${skipped} duplicates`);
    console.log(`[seed-demo-leads] Distribution:`, distribution);

    return { created, skipped, distribution };
}
