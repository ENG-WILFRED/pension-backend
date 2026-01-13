import { Router } from 'express';
import loginRouter from './login';
import otpRouter from './otp';
import passwordRouter from './password';
import verifyRouter from './verify';

const router = Router();

// Login routes
router.use('/', loginRouter);
router.use('/login', otpRouter);
router.use('/', passwordRouter);
router.use('/auth', verifyRouter);

export default router;
