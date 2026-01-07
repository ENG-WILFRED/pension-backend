import { Router } from 'express';
import listRoutes from './list';
import getRoutes from './get';
import contributionRoutes from './contribution';
import depositRoutes from './deposit';
import earningsRoutes from './earnings';
import withdrawRoutes from './withdraw';
import statusRoutes from './status';
import summaryRoutes from './summary';
import transactionsRoutes from './transactions';

const router = Router();

router.use('/', listRoutes);
router.use('/', getRoutes);
router.use('/', contributionRoutes);
router.use('/', depositRoutes);
router.use('/', earningsRoutes);
router.use('/', withdrawRoutes);
router.use('/', statusRoutes);
router.use('/', summaryRoutes);
router.use('/', transactionsRoutes);

export default router;
