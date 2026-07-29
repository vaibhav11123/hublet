/**
 * backfill-buyer-localities.ts
 *
 * One-time repair: buyers seeded before the seed-demo-buyers.ts fix (or created
 * before the buyer.controller.ts/auth.controller.ts fix) may have
 * metadata.localityCoords set (so matching works) but no metadata.localities
 * array (so the admin buyer table and analytics.service.ts's read of
 * metadata.localities show nothing). This backfills `localities` from
 * `localityCoords` names wherever the array is missing.
 */

import { PrismaClient } from '@prisma/client';

function safeParseJson(value: string | null | undefined, fallback: any = null) {
    if (!value) return fallback;
    try {
        return JSON.parse(value) ?? fallback;
    } catch {
        return fallback;
    }
}

export async function backfillBuyerLocalities(prisma: PrismaClient): Promise<{
    updated: number;
    skipped: number;
}> {
    const buyers = await prisma.buyer.findMany();
    let updated = 0;
    let skipped = 0;

    for (const buyer of buyers) {
        const metadata = safeParseJson(buyer.metadata, {});
        const hasCoords = Array.isArray(metadata.localityCoords) && metadata.localityCoords.length > 0;
        const hasLocalities = Array.isArray(metadata.localities) && metadata.localities.length > 0;

        if (hasCoords && !hasLocalities) {
            metadata.localities = metadata.localityCoords.map((c: { name: string }) => c.name);
            await prisma.buyer.update({
                where: { id: buyer.id },
                data: { metadata: JSON.stringify(metadata) },
            });
            updated++;
        } else {
            skipped++;
        }
    }

    console.log(`[backfill-buyer-localities] Updated ${updated}, skipped ${skipped}`);
    return { updated, skipped };
}
