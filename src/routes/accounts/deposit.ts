import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';
import { Transaction } from '../../entities/Transaction';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);
const transactionRepo = AppDataSource.getRepository(Transaction);

const depositSchema = z.object({
  amount: z.number().positive(),
  phone: z.string().optional(),
  description: z.string().optional(),
});

/**
 * @swagger
 * /api/accounts/{accountNumber}/deposit:
 *   post:
 *     tags:
 *       - Accounts
 *     summary: Deposit funds to an account (initiates M-Pesa STK Push)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: accountNumber
 *         in: path
 *         required: true
 *         description: Account number (8-digit format, e.g., 00000001)
 *         schema:
 *           type: string
 *           example: "00000001"
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
 *                 example: 500
 *               phone:
 *                 type: string
 *                 example: "+254712345678"
 *               description:
 *                 type: string
 *                 example: "Deposit to pension account"
 *     responses:
 *       '200':
 *         description: Payment initiated successfully
 *       '400':
 *         description: Invalid input
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Server error
 */
router.post('/:id/deposit', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Accept account number in the path (e.g. "00000001") and look up account by `accountNumber`.
    const accountNumber = String(req.params.id || '').trim();
    if (!accountNumber || !/^\d+$/.test(accountNumber)) {
      return res.status(400).json({ success: false, error: 'Invalid account number' });
    }

    const userId = (req.user as any).userId;
    const data = depositSchema.parse(req.body);

    // Find account by accountNumber. Don't require the authenticated user to match the account owner,
    // since deposits can be made to any valid account number.
    const account = await accountRepo.findOne({ where: { accountNumber } });
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    // Initiate payment via external payment gateway (same as registration flow)
    try {
      const mpesaInitiateUrl = `${process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_URL || 'https://payment-gateway-7eta.onrender.com'}/payments/mpesa/initiate`;
      const mpesaResponse = await import('axios').then(({ default: axios }) => axios.post(mpesaInitiateUrl, {
        phone: data.phone || (req.user as any).phone || null,
        amount: data.amount,
        referenceId: `Acct-${account.accountNumber}-${userId}`,
        accountReference: `ACC-${account.accountNumber}`,
        transactionDesc: data.description || 'Account Deposit',
        stkCallback: `${process.env.BACKEND_URL}/api/payment/callback`,
      }));

      const providerCheckoutId = mpesaResponse.data.data?.CheckoutRequestID;
      const checkoutId = providerCheckoutId ?? `CRID-${randomUUID()}`;

      // Persist a pending transaction for this deposit
      const transaction = await transactionRepo.create({
        userId,
        accountId: account.id,
        amount: Number(data.amount),
        type: 'deposit',
        status: 'pending',
        description: data.description || 'Account deposit',
        checkoutRequestId: checkoutId,
        metadata: {
          phone: data.phone || null,
          accountReference: `ACC-${account.accountNumber}`,
        },
      });

      await transactionRepo.save(transaction);

      return res.json({
        success: true,
        status: 'payment_initiated',
        message: 'Payment initiated. Please check your phone for the M-Pesa prompt.',
        transactionId: transaction.id,
        checkoutRequestId: checkoutId,
        statusCheckUrl: `/api/payment/status/${transaction.id}`,
      });
    } catch (paymentError: any) {
      console.error('Deposit M-Pesa initiation error:', paymentError?.message || paymentError);
      return res.status(500).json({ success: false, error: 'Failed to initiate payment. Please try again.' });
    }
  } catch (error: any) {
    console.error('Deposit error:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: error.errors });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
