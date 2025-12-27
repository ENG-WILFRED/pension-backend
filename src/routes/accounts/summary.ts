import { Router, Response } from 'express';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);

/**
 * @swagger
 * /api/accounts/{id}/summary:
 *   get:
 *     tags:
 *       - Accounts
 *     summary: Get account summary with all balances
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Account summary
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Server error
 */
router.get('/:id/summary', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid account id' });
    const userId = (req.user as any).userId;

    const account = await accountRepo.findOne({
      where: { id, userId },
      relations: ['transactions'],
    });

    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    // Calculate summary
    const summary = {
      accountNumber: account.accountNumber,
      accountType: account.accountType,
      accountStatus: account.accountStatus,
      currentBalance: account.currentBalance,
      availableBalance: account.availableBalance,
      lockedBalance: account.lockedBalance,
      totalContributions: Number(account.employeeContributions) + Number(account.employerContributions) + Number(account.voluntaryContributions),
      employeeContributions: account.employeeContributions,
      employerContributions: account.employerContributions,
      voluntaryContributions: account.voluntaryContributions,
      totalEarnings: Number(account.interestEarned) + Number(account.investmentReturns) + Number(account.dividendsEarned),
      interestEarned: account.interestEarned,
      investmentReturns: account.investmentReturns,
      dividendsEarned: account.dividendsEarned,
      totalWithdrawn: account.totalWithdrawn,
      taxWithheld: account.taxWithheld,
      kycVerified: account.kycVerified,
      complianceStatus: account.complianceStatus,
      openedAt: account.openedAt,
      lastContributionAt: account.lastContributionAt,
      lastWithdrawalAt: account.lastWithdrawalAt,
      transactionCount: account.transactions?.length || 0,
    };

    return res.json({ success: true, summary });
  } catch (error) {
    console.error('Get account summary error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
