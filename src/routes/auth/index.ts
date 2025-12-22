import { Router } from 'express';
import registerRoutes from './register';
import loginRoutes from './login';
import promoteRoutes from './promote';

const router = Router();

router.use('/', registerRoutes);
router.use('/', loginRoutes);
router.use('/', promoteRoutes);

export default router;
