import { Router } from 'express';
import { authMiddleware } from './middleware';
import { initiatePayment, getTransactionStatus, handlePaymentCallback } from './handlers';

const router = Router();

// Payment initiation endpoint - requires authentication
router.post('/initiate', authMiddleware, initiatePayment);

// Transaction status endpoint
router.get('/status/:transactionId', getTransactionStatus);

// Payment gateway callback endpoint
router.post('/callback', handlePaymentCallback);

export default router;
