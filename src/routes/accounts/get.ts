import { Router, Response } from 'express';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);

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

export default router;
