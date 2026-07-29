import { Request, Response } from 'express';
import prisma from '../db/prisma';

export class NotificationController {
  static async getNotifications(req: Request, res: Response) {
    try {
      const { userId, role } = req.query; // pass role='buyer' or 'seller'

      if (!userId || !role) {
        return res.status(400).json({ error: 'userId and role are required' });
      }

      const whereClause = role === 'buyer' ? { buyerId: userId as string } : { sellerId: userId as string };

      const notifications = await prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });

      return res.json(notifications);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const notification = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      return res.json(notification);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const { userId, role } = req.body;

      if (!userId || !role) {
        return res.status(400).json({ error: 'userId and role are required' });
      }

      const whereClause = role === 'buyer' ? { buyerId: userId } : { sellerId: userId };

      const result = await prisma.notification.updateMany({
        where: { ...whereClause, isRead: false },
        data: { isRead: true },
      });

      return res.json({ count: result.count });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
