import { Router } from 'express';
import apiKeyRoutes from './apiKeys.js';
import userRoutes from './users.js';
import guardrailRoutes from './guardrails.js';
import logRoutes from './logs.js';

const router = Router();

router.use('/api-keys', apiKeyRoutes);
router.use('/users', userRoutes);
router.use('/guardrails', guardrailRoutes);
router.use('/logs', logRoutes);

export default router;

