import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const router = Router();

router.post('/admin/login', AuthController.adminLogin);

router.post('/buyer/signup', AuthController.buyerSignup);
router.post('/buyer/login', AuthController.buyerLogin);

router.post('/seller/signup', AuthController.sellerSignup);
router.post('/seller/login', AuthController.sellerLogin);

export default router;
