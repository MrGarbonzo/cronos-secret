import { Router } from 'express';
import attestationRoute from './attestation.route.js';
import healthRoute from './health.route.js';
import queryRoute from './query.route.js';

const router = Router();

router.use('/health', healthRoute);
router.use('/api/query', queryRoute);
router.use('/api/attestation', attestationRoute);

export default router;
