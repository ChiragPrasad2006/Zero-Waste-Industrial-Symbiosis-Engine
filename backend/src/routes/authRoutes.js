import { Router } from 'express';
import { login, me, register, requestUpgrade, updateProfile } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.put('/profile', requireAuth, updateProfile);
router.post('/upgrade-request', requireAuth, requestUpgrade);

export default router;

