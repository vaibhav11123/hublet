import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();

// GET /api/notifications?userId=123&role=buyer
router.get('/', NotificationController.getNotifications);

// PATCH /api/notifications/read-all
// Body: { "userId": "123", "role": "buyer" }
router.patch('/read-all', NotificationController.markAllAsRead);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', NotificationController.markAsRead);

export default router;
