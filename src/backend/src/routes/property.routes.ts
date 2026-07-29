import { Router } from 'express';
import { PropertyController } from '../controllers/property.controller';
import { requireRoles } from '../middleware/auth.middleware';
import {
    requirePropertyCreateAccess,
    requirePropertyOwnerOrAdmin,
} from '../middleware/access.middleware';

const router = Router();

router.post('/', requireRoles('admin', 'seller'), requirePropertyCreateAccess, PropertyController.createProperty);
router.get('/map', requireRoles('admin', 'buyer', 'seller'), PropertyController.getPropertiesForMap);
router.get('/geocode', requireRoles('admin', 'buyer', 'seller'), PropertyController.geocode);
router.get('/reverse-geocode', requireRoles('admin', 'buyer', 'seller'), PropertyController.reverseGeocode);
router.get('/nearby-places', requireRoles('admin', 'buyer', 'seller'), PropertyController.getNearbyPlaces);

router.get('/', requireRoles('admin', 'buyer', 'seller'), PropertyController.getAllProperties);
router.get('/:id', requireRoles('admin', 'buyer', 'seller'), PropertyController.getPropertyById);
router.put('/:id', requireRoles('admin', 'seller'), requirePropertyOwnerOrAdmin('id'), PropertyController.updateProperty);
router.delete('/:id', requireRoles('admin', 'seller'), requirePropertyOwnerOrAdmin('id'), PropertyController.deleteProperty);
router.put('/:id/mark-sold', requireRoles('admin', 'seller'), requirePropertyOwnerOrAdmin('id'), PropertyController.markPropertyAsSold);

export default router;

