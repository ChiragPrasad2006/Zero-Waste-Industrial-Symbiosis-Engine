import { Router } from 'express';
import { getMessages, listConversations, openConversation, sendMessage } from '../controllers/chatController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/conversations', listConversations);
router.post('/conversations', openConversation);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);

export default router;

