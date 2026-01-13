import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';
import redis from '../../lib/redis';
import { comparePasswords, generateToken } from '../../lib/auth';
import { generateOtp } from '../../lib/otp';
import { sendOtpNotification } from '../../lib/notification';
import requireAuth, { AuthRequest } from '../../middleware/auth';
import { hashPassword } from '../../lib/auth';

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Change password (authenticated)
 *     description: Change the current user's password by verifying their existing password.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       '200':
 *         description: Password changed successfully
 *       '400':
 *         description: Invalid input or incorrect current password
 *       '401':
 *         description: Unauthorized
 *       '500':
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request password reset OTP
 *     description: Send OTP to user's email for password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       '200':
 *         description: OTP sent to email
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/auth/forgot-password/verify:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify OTP and reset password
 *     description: Verify the OTP sent to email and set a new password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 minLength: 6
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       '200':
 *         description: Password reset successfully
 *       '400':
 *         description: Invalid input or OTP mismatch
 *       '401':
 *         description: OTP expired or invalid
 *       '500':
 *         description: Internal server error
 */

const router = Router();

// POST /api/auth/change-password - authenticated
router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Current password and new password (min 6 chars) are required' });
    }

    const userId = (req.user as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Verify current password
    const match = await comparePasswords(currentPassword, user.password || '');
    if (!match) return res.status(400).json({ success: false, error: 'Current password is incorrect' });

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed, passwordIsTemporary: false } });
    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password - unauthenticated
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Generate OTP and store in Redis (10 minute expiry)
    const otp = generateOtp(6);
    await redis.set(`password-reset:${user.id}`, otp, { EX: 600 });
    console.log(`[Forgot Password] OTP for user ${email}: ${otp}`);

    // Send OTP via notification service using password-reset template
    sendOtpNotification(user.email, 'password-reset', 'email', otp, user.firstName, 10).catch((e) =>
      console.error('[Forgot Password] Failed sending OTP notification:', e)
    );

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password/verify - unauthenticated
router.post('/forgot-password/verify', async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Email, OTP, and new password (min 6 chars) are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    // Get OTP from Redis
    const storedOtp = await redis.get(`password-reset:${user.id}`);
    if (!storedOtp) {
      return res.status(401).json({ success: false, error: 'OTP expired or not found' });
    }

    if (storedOtp !== otp) {
      return res.status(401).json({ success: false, error: 'Invalid OTP' });
    }

    // OTP valid — set new password and clear OTP from Redis
    const hashed = await hashPassword(newPassword);
    await redis.del(`password-reset:${user.id}`);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed, passwordIsTemporary: false } });
    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Forgot password verify error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
