import { Router, Response } from 'express';
import { z } from 'zod';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';
import { Transaction } from '../../entities/Transaction';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);
const transactionRepo = AppDataSource.getRepository(Transaction);

const withdrawalSchema = z.object({
  amount: z.number().positive(),
  withdrawalType: z.string(),
  description: z.string().optional(),
});

/**
 * @swagger
 * /api/accounts/{id}/withdraw:
 *   post:
 *     tags:
 *       - Accounts
 *     summary: Withdraw funds from account
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - withdrawalType
 *             properties:
 *               amount:
 *                 type: number
 *               withdrawalType:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Withdrawal processed successfully
 *       '400':
 *         description: Invalid input or insufficient balance
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Server error
 */
router.post('/:id/withdraw', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid account id' });
    const userId = (req.user as any).userId;

    const data = withdrawalSchema.parse(req.body);

    const account = await accountRepo.findOne({
      where: { id, userId },
    });

    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    // Check if locked funds
    const availableForWithdrawal = Number(account.availableBalance);
    if (data.amount > availableForWithdrawal) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient available balance',
        available: availableForWithdrawal,
      });
    }

    // Process withdrawal
    account.totalWithdrawn = Number(account.totalWithdrawn) + data.amount;
    account.currentBalance = Number(account.currentBalance) - data.amount;
    account.availableBalance = Number(account.availableBalance) - data.amount;
    account.lastWithdrawalAt = new Date();

    await accountRepo.save(account);

    // Create transaction record
    const transaction = transactionRepo.create({
      userId,
      accountId: id,
      amount: -data.amount,
      type: `withdrawal_${data.withdrawalType}`,
      status: 'completed',
      description: data.description || 'Withdrawal',
      metadata: {
        withdrawalType: data.withdrawalType,
      },
    });

    await transactionRepo.save(transaction);

    return res.json({ success: true, account, transaction });
  } catch (error: any) {
    console.error('Withdraw error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
