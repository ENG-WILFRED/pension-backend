import { Router, Response } from 'express';
import { z } from 'zod';
import AppDataSource from '../lib/data-source';
import { AccountType } from '../entities/AccountType';
import requireAuth, { AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();
const accountTypeRepo = AppDataSource.getRepository(AccountType);

const createAccountTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  interestRate: z.number().optional(),
});

/**
 * @swagger
 * /api/account-types:
 *   post:
 *     tags:
 *       - Accounts
 *     summary: Create a new account type (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               interestRate:
 *                 type: number
 *     responses:
 *       '201':
 *         description: Account type created
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden (not admin)
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = createAccountTypeSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: validation.error.issues[0].message });

    const payload = req.user as any;
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Only admins can create account types' });

    const { name, description, interestRate } = validation.data;

    // Prevent duplicates
    const existing = await accountTypeRepo.findOne({ where: { name } });
    if (existing) return res.status(400).json({ success: false, error: 'Account type with that name already exists' });

    const at = accountTypeRepo.create({ name, description, interestRate });
    const saved = await accountTypeRepo.save(at);
    return res.status(201).json({ success: true, accountType: saved });
  } catch (error) {
    console.error('Create account type error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
