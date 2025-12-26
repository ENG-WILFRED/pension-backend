import { Router, Response } from 'express';
import { z } from 'zod';
import AppDataSource from '../lib/data-source';
import { Account } from '../entities/Account';
import { AccountType } from '../entities/AccountType';
import { User } from '../entities/User';
import { Transaction } from '../entities/Transaction';
import requireAuth, { AuthRequest } from '../middleware/auth';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);
const accountTypeRepo = AppDataSource.getRepository(AccountType);
const userRepo = AppDataSource.getRepository(User);
const transactionRepo = AppDataSource.getRepository(Transaction);

// Validation schemas for account creation
const createAccountSchema = z.object({
  // Either supply `accountTypeId` (admin-created) or a legacy enum `accountType`.
  accountTypeId: z.string().uuid().optional(),
  accountType: z.enum(['MANDATORY', 'VOLUNTARY', 'EMPLOYER', 'SAVINGS', 'WITHDRAWAL', 'BENEFITS']).optional().default('MANDATORY'),
  riskProfile: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  interestRate: z.number().optional(),
  investmentPlanId: z.string().uuid().optional(),
  currency: z.string().length(3).default('KES'),
  beneficiaryDetails: z.object({}).optional(),
});

const contributionSchema = z.object({
  employeeAmount: z.number().positive(),
  employerAmount: z.number().positive().optional(),
  description: z.string().optional(),
});

const withdrawalSchema = z.object({
  amount: z.number().positive(),
  withdrawalType: z.string(),
  description: z.string().optional(),
});

const updateBalanceSchema = z.object({
  type: z.enum(['interest', 'investment_returns', 'dividends']),
  amount: z.number(),
  description: z.string().optional(),
});


/**
 * @swagger
 * /api/accounts:
 *   get:
 *     tags:
 *       - Accounts
 *     summary: List all accounts for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of user accounts
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Server error
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const accounts = await accountRepo.find({
      where: { userId },
      relations: ['transactions'],
      order: { createdAt: 'DESC' },
    });
    return res.json({ success: true, accounts });
  } catch (error) {
    console.error('List accounts error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/accounts/{id}:
 *   get:
 *     tags:
 *       - Accounts
 *     summary: Get account details
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
 *         description: Account details
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Server error
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid account id' });
    const userId = (req.user as any).userId;

    const account = await accountRepo.findOne({
      where: { id, userId },
      relations: ['transactions', 'user'],
    });

    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    return res.json({ success: true, account });
  } catch (error) {
    console.error('Get account error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
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

/**
 * @swagger
 * /api/accounts/{id}/status:
 *   put:
 *     tags:
 *       - Accounts
 *     summary: Update account status
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
 *               - accountStatus
 *             properties:
 *               accountStatus:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, CLOSED, FROZEN, DECEASED]
 *     responses:
 *       '200':
 *         description: Account status updated
 *       '400':
 *         description: Invalid input
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Account not found
 *       '500':
 *         description: Server error
 */
router.put('/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid account id' });
    const userId = (req.user as any).userId;
    const { accountStatus } = req.body;

    if (!['ACTIVE', 'SUSPENDED', 'CLOSED', 'FROZEN', 'DECEASED'].includes(accountStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid account status' });
    }

    const account = await accountRepo.findOne({
      where: { id, userId },
    });

    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });

    account.accountStatus = accountStatus;
    await accountRepo.save(account);

    return res.json({ success: true, account });
  } catch (error) {
    console.error('Update account status error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

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
