import { Router, Response } from 'express';
import { z } from 'zod';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';
import { Transaction } from '../../entities/Transaction';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);
const transactionRepo = AppDataSource.getRepository(Transaction);

const contributionSchema = z.object({
  employeeAmount: z.number().positive(),
  employerAmount: z.number().positive().optional(),
  description: z.string().optional(),
});

/**
 * @swagger
 * /api/accounts/{id}/contribution:
 *   post:
 *     tags:
 *       - Accounts
 *     summary: Add contribution to account
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
 *               - employeeAmount
 *             properties:
 *               employeeAmount:
 *                 type: number
 *               employerAmount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Contribution added successfully
 *       '400':
 *         description: Invalid input
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Server error
 */
router.post('/:id/contribution', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid account id' });
    const userId = (req.user as any).userId;

    const data = contributionSchema.parse(req.body);

    const account = await accountRepo.findOne({
      where: { id, userId },
    });

    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    // Update contributions
    account.employeeContributions = Number(account.employeeContributions) + data.employeeAmount;
    if (data.employerAmount) {
      account.employerContributions = Number(account.employerContributions) + data.employerAmount;
    }

    // Update balances
    const totalContribution = data.employeeAmount + (data.employerAmount || 0);
    account.currentBalance = Number(account.currentBalance) + totalContribution;
    account.availableBalance = Number(account.availableBalance) + totalContribution;
    account.lastContributionAt = new Date();

    await accountRepo.save(account);

    // Create transaction record
    const transaction = transactionRepo.create({
      userId,
      accountId: id,
      amount: totalContribution,
      type: 'contribution',
      status: 'completed',
      description: data.description || 'Pension contribution',
      metadata: {
        employeeAmount: data.employeeAmount,
        employerAmount: data.employerAmount || 0,
      },
    });

    await transactionRepo.save(transaction);

    return res.json({ success: true, account, transaction });
  } catch (error: any) {
    console.error('Add contribution error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
