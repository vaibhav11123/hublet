/**
 * reset-seller-trust.ts
 * 
 * Resets ALL sellers' trust-related fields back to zero:
 *   - trustScore → 0
 *   - completedDeals → 0
 *   - rating → 0
 * 
 * This module is entirely self-contained and does NOT affect other code.
 */

import { PrismaClient } from '@prisma/client';

export async function resetSellerTrust(prisma: PrismaClient): Promise<{
    updated: number;
    sellers: Array<{ id: string; name: string; email: string }>;
}> {
    // Fetch all sellers first (for the response)
    const allSellers = await prisma.seller.findMany({
        select: { id: true, name: true, email: true },
    });

    // Reset all in one bulk update
    const result = await prisma.seller.updateMany({
        data: {
            trustScore: 0,
            completedDeals: 0,
            rating: 0,
        },
    });

    return {
        updated: result.count,
        sellers: allSellers,
    };
}

// ── Allow running standalone via `npx tsx src/scripts/reset-seller-trust.ts` ──
if (require.main === module) {
    const prisma = new PrismaClient();
    resetSellerTrust(prisma)
        .then(({ updated, sellers }) => {
            console.log(`\n Reset trust scores for ${updated} sellers\n`);
            sellers.forEach((s) => console.log(`  ${s.name} (${s.email}) → trust=0, deals=0, rating=0`));
        })
        .catch((e) => {
            console.error(' Reset failed:', e);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}
