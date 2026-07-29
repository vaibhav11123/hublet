import prisma from '../db/prisma';
import { sendMatchEmail } from './email.service';

export class NotificationService {
  /**
   * Generates notifications and emails for a buyer about new matches
   */
  static async notifyBuyerOfMatches(buyerId: string, matchCount: number) {
    if (matchCount <= 0) return;

    try {
      const buyer = await prisma.buyer.findUnique({ where: { id: buyerId } });
      if (!buyer) return;

      // 1. Create DB Notification
      await prisma.notification.create({
        data: {
          buyerId,
          title: 'New Matches Found',
          message: `Explore ${matchCount} new properties matching your preferences.`,
          isRead: false,
        },
      });

      // 2. Dispatch Email
      await sendMatchEmail(buyer.email, buyer.name, true, matchCount);
    } catch (error) {
      console.error(`[NotificationService] Error notifying buyer ${buyerId}:`, error);
    }
  }

  /**
   * Generates notifications and emails for a seller about new interested buyers (matches)
   */
  static async notifySellerOfMatches(propertyId: string, matchCount: number) {
    if (matchCount <= 0) return;

    try {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        include: { seller: true }
      });
      
      if (!property || !property.seller) return;

      const seller = property.seller;

      // 1. Create DB Notification
      await prisma.notification.create({
        data: {
          sellerId: seller.id,
          title: 'New Buyer Interest',
          message: `Your property "${property.title}" has ${matchCount} new matching buyers.`,
          isRead: false,
        },
      });

      // 2. Dispatch Email
      await sendMatchEmail(seller.email, seller.name, false, matchCount);
    } catch (error) {
      console.error(`[NotificationService] Error notifying seller for property ${propertyId}:`, error);
    }
  }
}
