/**
 * migrate-demo-emails.ts
 *
 * One-time repair: buyers/sellers seeded before the seed-demo-buyers.ts/
 * seed-demo-sellers.ts @demo.com -> @gmail.com fix still have the old
 * domain in the live database. This migrates existing records to match,
 * preserving each email's local-part, and keeps credentials-log.json in
 * sync so the admin "View Credentials" feature doesn't show stale,
 * no-longer-working emails.
 */

import { PrismaClient } from '@prisma/client';
import { updateCredentialEmail } from '../utils/credential-logger';

function toGmail(email: string): string {
    return email.replace(/@demo\.com$/, '@gmail.com');
}

export async function migrateDemoEmails(prisma: PrismaClient): Promise<{
    buyersUpdated: number;
    sellersUpdated: number;
}> {
    const buyers = await prisma.buyer.findMany({ where: { email: { endsWith: '@demo.com' } } });
    let buyersUpdated = 0;
    for (const buyer of buyers) {
        const newEmail = toGmail(buyer.email);
        await prisma.buyer.update({ where: { id: buyer.id }, data: { email: newEmail } });
        updateCredentialEmail(buyer.email, newEmail);
        buyersUpdated++;
    }

    const sellers = await prisma.seller.findMany({ where: { email: { endsWith: '@demo.com' } } });
    let sellersUpdated = 0;
    for (const seller of sellers) {
        const newEmail = toGmail(seller.email);
        await prisma.seller.update({ where: { id: seller.id }, data: { email: newEmail } });
        updateCredentialEmail(seller.email, newEmail);
        sellersUpdated++;
    }

    console.log(`[migrate-demo-emails] Updated ${buyersUpdated} buyers, ${sellersUpdated} sellers`);
    return { buyersUpdated, sellersUpdated };
}
