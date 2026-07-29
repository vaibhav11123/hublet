/**
 * reset-database.ts
 *
 * Wipes ALL data from the SQLite database and optionally re-seeds demo buyers.
 * Admin-only endpoint.
 */

import { PrismaClient } from '@prisma/client';
import { seedDemoBuyers } from './seed-demo-buyers';
import { logCredentials, clearCredentials } from '../utils/credential-logger';

/**
 * Delete all records from all tables in the correct order (respecting FK constraints).
 */
export async function resetDatabase(
    prisma: PrismaClient,
    options: { reseed?: boolean } = { reseed: true }
): Promise<{
    deleted: Record<string, number>;
    seeded?: { created: number; skipped: number };
}> {
    // Delete in order: dependents first, then parents
    const workflowEvents = await prisma.workflowEvent.deleteMany({});
    const leads = await prisma.lead.deleteMany({});
    const matches = await prisma.match.deleteMany({});
    const properties = await prisma.property.deleteMany({});
    const buyers = await prisma.buyer.deleteMany({});
    const sellers = await prisma.seller.deleteMany({});

    const deleted = {
        workflowEvents: workflowEvents.count,
        leads: leads.count,
        matches: matches.count,
        properties: properties.count,
        buyers: buyers.count,
        sellers: sellers.count,
    };

    let seeded: { created: number; skipped: number } | undefined;

    // Clear credential log since all users are gone
    clearCredentials();

    if (options.reseed) {
        const result = await seedDemoBuyers(prisma);
        seeded = { created: result.created, skipped: result.skipped };

        // Log seeded credentials
        logCredentials(
            result.buyers.map((b) => ({
                role: 'buyer' as const,
                name: b.name,
                email: b.email,
                password: b.password,
                source: 'seeder' as const,
            }))
        );
    }

    return { deleted, seeded };
}
