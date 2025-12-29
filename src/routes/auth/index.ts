import { Router } from 'express';
import registerRoutes from './register';
import loginRoutes from './login';
import promoteRoutes from './promote';
import passwordRoutes from './password';
import pinRoutes from './pin';
import ussdRoutes from './ussd-login';

const router = Router();

router.use('/', registerRoutes);
router.use('/', loginRoutes);
router.use('/', promoteRoutes);
router.use('/', passwordRoutes);
router.use('/', pinRoutes);
router.use('/', ussdRoutes);

export default router;
