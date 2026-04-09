import { Router } from 'express';
import attestationRoute from './attestation.route.js';
import healthRoute from './health.route.js';
import queryRoute from './query.route.js';
import queryStreamRoute from './query-stream.route.js';
import secretaiAttestationRoute from './secretai-attestation.route.js';

const router = Router();

router.use('/health', healthRoute);
router.use('/api/query/stream', queryStreamRoute);
router.use('/api/query', queryRoute);
router.use('/api/attestation', attestationRoute);
router.use('/api/secretai-attestation', secretaiAttestationRoute);

export default router;
