import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { verifyToken, TokenPayload } from '../lib/auth';

const router = Router();

// Middleware to verify authentication
const authMiddleware = (req: Request, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

const purchaseSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  planId: z.string().optional(),
  description: z.string().optional(),
});

/**
 * @swagger
 * /api/payment/initiate:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Initiate a pension contribution payment
 *     description: Creates a pending payment transaction for pension contribution and generates a payment gateway URL
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 format: double
 *                 minimum: 0.01
 *                 example: 500
 *               planId:
 *                 type: string
 *                 example: "premium-plan"
 *               description:
 *                 type: string
 *                 example: "Monthly pension contribution"
 *     responses:
 *       200:
 *         description: Payment initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 paymentUrl:
 *                   type: string
 *                 transaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     status:
 *                       type: string
 *       400:
 *         description: Invalid input or missing payment gateway configuration
 *       401:
 *         description: Not authenticated or invalid token
 *       500:
 *         description: Internal server error
 */
router.post('/initiate', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const validation = purchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { amount, planId, description } = validation.data;

    // Create a pending contribution transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.userId,
        amount,
        type: 'pension_contribution',
        status: 'pending',
        description: description || `Pension contribution${planId ? ` (plan ${planId})` : ''}`,
      },
    });

    // Build external payment gateway URL
    const gatewayBase = process.env.PAYMENT_GATEWAY_URL;
    if (!gatewayBase) {
      return res.status(400).json({
        success: false,
        error: 'Payment gateway not configured.',
      });
    }

    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/payment/callback`;
    const url = new URL(gatewayBase);
    url.searchParams.set('transactionId', transaction.id);
    url.searchParams.set('amount', amount.toString());
    url.searchParams.set('planId', planId || '');
    url.searchParams.set('callbackUrl', callbackUrl);

    res.json({
      success: true,
      message: 'Redirecting to payment gateway...',
      paymentUrl: url.toString(),
      transaction: { id: transaction.id, amount, status: transaction.status },
    });
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate payment' });
  }
});

/**
 * @swagger
 * /api/payment/status/{transactionId}:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Get transaction status
 *     description: Retrieves the current status of a payment transaction
 *     parameters:
 *       - name: transactionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID to check
 *     responses:
 *       200:
 *         description: Transaction found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     type:
 *                       type: string
 *                       enum: ["registration", "pension_contribution"]
 *                     status:
 *                       type: string
 *                       enum: ["pending", "completed", "failed"]
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
router.get('/status/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
  }
});

/**
 * @swagger
 * /api/payment/callback:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Payment gateway callback
 *     description: Webhook endpoint for payment gateway to update transaction status after payment processing
 *     parameters:
 *       - name: x-gateway-secret
 *         in: header
 *         required: false
 *         schema:
 *           type: string
 *         description: Gateway secret for verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - status
 *             properties:
 *               transactionId:
 *                 type: string
 *                 example: "txn_abc123xyz"
 *               status:
 *                 type: string
 *                 enum: ["pending", "completed", "failed"]
 *                 example: "completed"
 *     responses:
 *       200:
 *         description: Transaction updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 transaction:
 *                   type: object
 *       400:
 *         description: Missing required fields
 *       403:
 *         description: Invalid gateway secret
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { transactionId, status } = req.body;
    const secret = req.headers['x-gateway-secret'];

    // Verify gateway secret if configured
    const gatewaySecret = process.env.PAYMENT_GATEWAY_SECRET;
    if (gatewaySecret && secret !== gatewaySecret) {
      console.warn('Gateway callback with invalid secret');
      return res.status(403).json({ success: false, error: 'Invalid gateway secret' });
    }

    if (!transactionId || !status) {
      return res.status(400).json({ success: false, error: 'Missing transactionId or status' });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Update transaction status
    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status },
    });

    res.json({ success: true, message: 'Transaction updated', transaction: updated });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
