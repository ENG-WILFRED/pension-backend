import { Router, Response } from 'express';
import AppDataSource from '../../lib/data-source';
import { Transaction } from '../../entities/Transaction';
import { Account } from '../../entities/Account';
import requireAuth, { AuthRequest } from '../../middleware/auth';
import prisma from '../../lib/prisma';

const router = Router();
const transactionRepo = AppDataSource.getRepository(Transaction);
const accountRepo = AppDataSource.getRepository(Account);

/**
 * @swagger
 * /api/accounts/{id}/transactions:
 *   get:
 *     tags:
 *       - Accounts
 *     summary: Get transactions for an account
 *     description: Returns transactions belonging to the specified account. Supports `limit`, `page`, and `sort` (asc|desc) query parameters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of transactions to return
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-based)
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort by `createdAt` field
 *     responses:
 *       '200':
 *         description: Transactions returned
 *       '400':
 *         description: Bad request
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden
 */
router.get('/:id/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid account id' });

    const caller = await prisma.user.findUnique({ where: { id: (req.user as any).userId } });
    if (!caller) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // If not admin, ensure the account belongs to the caller
    const account = await accountRepo.findOne({ where: { id } });
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    if (caller.role !== 'admin' && account.userId !== caller.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 1000);
    const page = Math.max(parseInt((req.query.page as string) || '1', 10) || 1, 1);
    const sort = (req.query.sort as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const skip = (page - 1) * limit;

    const transactions = await transactionRepo.find({
      where: { accountId: id } as any,
      relations: ['account', 'user'],
      order: { createdAt: sort as any },
      take: limit,
      skip,
    });

    return res.json({ success: true, transactions, meta: { limit, page, sort: sort.toLowerCase() } });
  } catch (error) {
    console.error('Get account transactions error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/accounts/transactions?accountId=123&limit=50&page=1&sort=desc
 * Accepts `accountId` as a required query parameter. Useful when the client wants to select
 * which of their multiple accounts to fetch transactions for.
 */
router.get('/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = Number(req.query.accountId);
    if (!accountId || isNaN(accountId)) return res.status(400).json({ success: false, error: 'Please provide a valid accountId query parameter' });

    const caller = await prisma.user.findUnique({ where: { id: (req.user as any).userId } });
    if (!caller) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const account = await accountRepo.findOne({ where: { id: accountId } });
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    if (caller.role !== 'admin' && account.userId !== caller.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 1000);
    const page = Math.max(parseInt((req.query.page as string) || '1', 10) || 1, 1);
    const sort = (req.query.sort as string)?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const skip = (page - 1) * limit;

    const transactions = await transactionRepo.find({
      where: { accountId } as any,
      relations: ['account', 'user'],
      order: { createdAt: sort as any },
      take: limit,
      skip,
    });

    return res.json({ success: true, transactions, meta: { limit, page, sort: sort.toLowerCase(), accountId } });
  } catch (error) {
    console.error('Get account transactions (query) error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
