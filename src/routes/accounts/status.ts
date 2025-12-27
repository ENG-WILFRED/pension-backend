import { Router, Response } from 'express';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();
const accountRepo = AppDataSource.getRepository(Account);

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

export default router;
