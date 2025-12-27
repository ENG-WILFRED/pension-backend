import { Router, Response } from 'express';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);

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

export default router;
