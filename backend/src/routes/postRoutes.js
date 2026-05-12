import { Router } from 'express';
import { categories, createPost, deletePost, listPosts, myPosts } from '../controllers/postController.js';
import { requireAuth, requireSuperiorAccess } from '../middleware/auth.js';

const router = Router();

router.get('/', listPosts);
router.get('/categories', categories);
router.get('/mine', requireAuth, myPosts);
router.post('/', requireAuth, requireSuperiorAccess, createPost);
router.delete('/:id', requireAuth, deletePost);

export default router;

