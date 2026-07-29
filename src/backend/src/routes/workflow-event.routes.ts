import { Router } from 'express';
import { WorkflowEventController } from '../controllers/workflow-event.controller';
import { requireRoles } from '../middleware/auth.middleware';
import { requireLeadEventsAccess } from '../middleware/access.middleware';

const router = Router();

router.get('/', requireRoles('admin'), WorkflowEventController.getAllEvents);
router.get('/lead/:leadId', requireRoles('admin', 'buyer', 'seller'), requireLeadEventsAccess('leadId'), WorkflowEventController.getEventsByLead);

export default router;
