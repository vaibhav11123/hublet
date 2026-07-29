import { Router } from 'express';
import { LeadController } from '../controllers/lead.controller';
import { requireRoles } from '../middleware/auth.middleware';
import { requireLeadAccess, requireLeadCreateAccess } from '../middleware/access.middleware';

const router = Router();

router.post('/', requireRoles('admin', 'buyer', 'seller'), requireLeadCreateAccess, LeadController.createLead);
router.get('/', requireRoles('admin', 'buyer', 'seller'), LeadController.getAllLeads);
router.get('/:id', requireRoles('admin', 'buyer', 'seller'), requireLeadAccess('id'), LeadController.getLeadById);
router.post('/:id/transition', requireRoles('admin', 'buyer', 'seller'), requireLeadAccess('id'), LeadController.transitionState);
router.get('/:id/allowed-states', requireRoles('admin', 'buyer', 'seller'), requireLeadAccess('id'), LeadController.getAllowedNextStates);

export default router;
