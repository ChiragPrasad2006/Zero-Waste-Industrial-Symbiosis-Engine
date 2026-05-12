import { Router } from 'express';
import { dashboard, reviewPost, reviewUpgrade } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));
router.get('/dashboard', dashboard);
router.put('/posts/:id', reviewPost);
router.put('/upgrades/:id', reviewUpgrade);

export default router;

