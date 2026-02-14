import { Router, Request, Response } from 'express';
import prisma from '../../../lib/prisma';
import { hashPassword } from '../../../lib/auth';
import requireAuth, { AuthRequest } from '../../../middleware/auth';
import { setPasswordSchema } from './schemas';

const router = Router();

/**
 * @swagger
 * /api/auth/set-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Set permanent password (authenticated)
 *     description: Set or update the user's permanent password and optionally set a 4-digit PIN. Requires valid JWT token.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: New permanent password
 *               pin:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 4
 *                 description: (Optional) 4-digit PIN
 *           example:
 *             password: "newPassword123"
 *             pin: "1234"
 *     responses:
 *       200:
 *         description: Password set successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

// POST /api/auth/set-password - Set permanent password (authenticated)
router.post('/set-password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = setPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const userId = (req.user as any).userId;
    const { password, pin } = validation.data;
    const updates: any = {};

    const hashed = await hashPassword(password);
    updates.password = hashed;
    updates.passwordIsTemporary = false;

    if (pin) {
      const hashedPin = await hashPassword(pin);
      updates.pin = hashedPin;
    }

    await prisma.user.update({ where: { id: userId }, data: updates });
    return res.json({ success: true, message: 'Password set successfully' });
  } catch (error) {
    console.error('Set password error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
