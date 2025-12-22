import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();

const promoteSchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
}).refine((data) => !!data.email || !!data.userId, {
  message: 'Either email or userId is required',
});

/**
 * @swagger
 * /api/auth/promote:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Promote a customer to admin
 *     description: |
 *       Promote an existing user with role `customer` to `admin`. Only callers with a valid
 *       admin Bearer token may perform this action. The target user must already be a customer.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - required: [email]
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *               - required: [userId]
 *                 properties:
 *                   userId:
 *                     type: string
 *                     format: uuid
 *     responses:
 *       '200':
 *         description: User promoted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       '400':
 *         description: Bad request (validation error or target not a customer)
 *       '401':
 *         description: Unauthorized (missing or invalid token)
 *       '403':
 *         description: Forbidden (caller is not an admin)
 *       '404':
 *         description: Target user not found
 */
router.post('/promote', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = promoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { email, userId } = validation.data;

    // Caller payload attached by requireAuth
    const payload = req.user as any;

    // Ensure caller is an admin
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can promote users' });
    }

    // Find target user
    const target = email
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findUnique({ where: { id: userId! } });

    if (!target) return res.status(404).json({ success: false, error: 'Target user not found' });

    // Must be customer to be promoted
    if (target.role !== 'customer') {
      return res.status(400).json({ success: false, error: 'Target must be a customer to be promoted' });
    }

    // Promote
    await prisma.user.update({ where: { id: target.id }, data: { role: 'admin' } });

    return res.json({ success: true, message: 'User promoted to admin' });
  } catch (error) {
    console.error('Promote error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

/**
 * @swagger
 * /api/auth/demote:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Demote an admin to customer
 *     description: |
 *       Demote an existing user with role `admin` back to `customer`. Only callers with a valid
 *       admin Bearer token may perform this action. The target user must currently be an admin.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - required: [email]
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *               - required: [userId]
 *                 properties:
 *                   userId:
 *                     type: string
 *                     format: uuid
 *     responses:
 *       '200':
 *         description: User demoted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       '400':
 *         description: Bad request (validation error or target not an admin)
 *       '401':
 *         description: Unauthorized (missing or invalid token)
 *       '403':
 *         description: Forbidden (caller is not an admin)
 *       '404':
 *         description: Target user not found
 */
router.post('/demote', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = promoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { email, userId } = validation.data;

    const payload = req.user as any;

    // Ensure caller is an admin
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can demote users' });
    }

    // Find target user
    const target = email
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findUnique({ where: { id: userId! } });

    if (!target) return res.status(404).json({ success: false, error: 'Target user not found' });

    // Must be admin to be demoted
    if (target.role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Target must be an admin to be demoted' });
    }

    // Prevent self-demotion
    if (target.id === payload.userId) {
      return res.status(400).json({ success: false, error: 'Admins cannot demote themselves' });
    }

    // Demote
    await prisma.user.update({ where: { id: target.id }, data: { role: 'customer' } });

    return res.json({ success: true, message: 'User demoted to customer' });
  } catch (error) {
    console.error('Demote error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

