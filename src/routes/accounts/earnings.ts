import { Router, Response } from 'express';
import { z } from 'zod';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';
import { Transaction } from '../../entities/Transaction';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);
const transactionRepo = AppDataSource.getRepository(Transaction);

const updateBalanceSchema = z.object({
  type: z.enum(['interest', 'investment_returns', 'dividends']),
  amount: z.number(),
  description: z.string().optional(),
});

/**
 * @swagger
 * /api/accounts/{id}/earnings:
 *   post:
 *     tags:
 *       - Accounts
 *     summary: Add earnings to account (interest, investment returns, dividends)
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
 *               - type
 *               - amount
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [interest, investment_returns, dividends]
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Earnings added successfully
 *       '400':
 *         description: Invalid input
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Server error
 */
router.post('/:id/earnings', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid account id' });
    const userId = (req.user as any).userId;

    const data = updateBalanceSchema.parse(req.body);

    const account = await accountRepo.findOne({
      where: { id, userId },
    });

    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    // Update appropriate earnings field
    if (data.type === 'interest') {
      account.interestEarned = Number(account.interestEarned) + data.amount;
    } else if (data.type === 'investment_returns') {
      account.investmentReturns = Number(account.investmentReturns) + data.amount;
    } else if (data.type === 'dividends') {
      account.dividendsEarned = Number(account.dividendsEarned) + data.amount;
    }

    // Update balances
    account.currentBalance = Number(account.currentBalance) + data.amount;
    account.availableBalance = Number(account.availableBalance) + data.amount;

    await accountRepo.save(account);

    // Create transaction record
    const transaction = transactionRepo.create({
      userId,
      accountId: id,
      amount: data.amount,
      type: `earnings_${data.type}`,
      status: 'completed',
      description: data.description || `${data.type} earned`,
    });

    await transactionRepo.save(transaction);

    return res.json({ success: true, account, transaction });
  } catch (error: any) {
    console.error('Add earnings error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
