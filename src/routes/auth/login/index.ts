import { Router } from 'express';
import handlers from './handlers';

const router = Router();
router.use('/', handlers);

export default router;
