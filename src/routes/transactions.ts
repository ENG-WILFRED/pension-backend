import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import AppDataSource from '../lib/data-source';
import { Transaction } from '../entities/Transaction';
import requireAuth, { AuthRequest } from '../middleware/auth';
import { generateTransactionPdf } from '../lib/pdf';

const router = Router();

/**
 * @swagger
 * /api/transactions/user/recent-deposits:
 *   get:
 *     tags:
 *       - Transactions
 *     summary: Get recent deposit transactions for the authenticated user
 *     description: Returns recent deposit transactions for the authenticated user, ordered by most recent first.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of recent deposits to return
 *     responses:
 *       '200':
 *         description: User's recent deposit transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *       '401':
 *         $ref: '#/components/schemas/Error'
 *       '500':
 *         $ref: '#/components/schemas/Error'
 */
router.get('/user/recent-deposits', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    const transactionRepo = AppDataSource.getRepository(Transaction);
    const transactions = await transactionRepo.find({
      where: {
        userId,
        type: 'deposit',
      } as any,
      relations: ['account'],
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });

    return res.json({ success: true, transactions });
  } catch (error) {
    console.error('Get recent deposits error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     tags:
 *       - Transactions
 *     summary: Get all transactions (admin only)
 *     description: Returns all transactions. Use `?pdf=true` to get a generated PDF file.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pdf
 *         schema:
 *           type: boolean
 *         description: If true, returns a PDF file attachment of the transactions
 *     responses:
 *       '200':
 *         description: Successful response with transactions or PDF
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       '401':
 *         $ref: '#/components/schemas/Error'
 *       '403':
 *         description: Forbidden - admin only
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         $ref: '#/components/schemas/Error'
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const caller = await prisma.user.findUnique({ where: { id: (req.user as any).userId } });
    if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Admins only' });

    const transactions = await prisma.transaction.findMany({});

    // If pdf query param is present, generate PDF
    if (req.query.pdf === 'true') {
      const buffer = await generateTransactionPdf(transactions, 'All Transactions Report');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.pdf');
      return res.send(buffer);
    }

    return res.json({ success: true, transactions });
  } catch (error) {
    console.error('Admin get transactions error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
