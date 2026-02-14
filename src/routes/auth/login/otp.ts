import { Router, Request, Response } from 'express';
import prisma from '../../../lib/prisma';
import redis from '../../../lib/redis';
import { hashPassword, generateToken } from '../../../lib/auth';
import { generateOtp } from '../../../lib/otp';
import { sendOtpNotification } from '../../../lib/notification';
import { otpVerifySchema } from './schemas';

const router = Router();

/**
 * @swagger
 * /api/auth/login/otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify OTP and obtain login token
 *     description: Verify the OTP sent to email/phone. If user has a temporary password, optionally set a permanent one. Returns JWT token on success.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - otp
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: User email or phone number
 *               otp:
 *                 type: string
 *                 description: 6-digit OTP sent to user
 *               newPassword:
 *                 type: string
 *                 description: (Optional) New permanent password if user has temporary password
 *           example:
 *             identifier: "john.doe@example.com"
 *             otp: "123456"
 *             newPassword: "newPassword123"
 *     responses:
 *       200:
 *         description: OTP valid - either login successful or prompting for permanent password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 temporary:
 *                   type: boolean
 *                   description: True if user has temporary password and needs to set a permanent one
 *                 token:
 *                   type: string
 *                   description: JWT token (present if login successful)
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid OTP or credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *       500:
 *         description: Server error
 */

// POST /api/auth/login/otp - Verify OTP and issue token
router.post('/otp', async (req: Request, res: Response) => {
  try {
    const validation = otpVerifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { identifier, otp, newPassword } = validation.data;
    const user = await prisma.user.findFirst({ where: [{ email: identifier }, { phone: identifier }] });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid OTP or credentials' });
    }

    // Get OTP from Redis
    const storedOtp = await redis.get(`otp:${user.id}`);
    if (!storedOtp) {
      return res.status(401).json({ success: false, error: 'OTP expired or not found' });
    }

    if (storedOtp !== otp) {
      return res.status(401).json({ success: false, error: 'Invalid OTP' });
    }

    // OTP valid: if user has temporary password, prompt for permanent one
    if (user.passwordIsTemporary) {
      if (!newPassword) {
        return res.status(200).json({
          success: true,
          temporary: true,
          message: 'OTP valid. Please set a permanent password by providing `newPassword`.',
        });
      }

      const hashed = await hashPassword(newPassword);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed, passwordIsTemporary: false } });
    }

    // Clear OTP from Redis and issue token
    await redis.del(`otp:${user.id}`);
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0 } });
    const token = generateToken({ userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role, lastName: user.lastName },
    });
  } catch (error) {
    console.error('OTP login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Resend OTP to user
 *     description: Resend the OTP to the user's email and phone. OTP must already exist and not have expired from a previous login attempt.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: User email or phone number
 *           example:
 *             identifier: "john.doe@example.com"
 *     responses:
 *       200:
 *         description: OTP resent successfully
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
 *         description: Missing identifier
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *       401:
 *         description: No OTP found - initiate login first
 *       500:
 *         description: Server error
 */

// POST /api/auth/resend-otp - Resend OTP
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Identifier (email or phone) is required' });
    }

    const user = await prisma.user.findFirst({
      where: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Check if OTP exists in Redis
    const existingOtp = await redis.get(`otp:${user.id}`);
    if (!existingOtp) {
      return res.status(401).json({ success: false, error: 'No OTP found. Please initiate login first.' });
    }

    // Generate new OTP and store in Redis (10 minute expiry)
    const newOtp = generateOtp(6);
    await redis.set(`otp:${user.id}`, newOtp, { EX: 600 });
    console.log(`[RESEND-OTP] New OTP for ${user.email}: ${newOtp}`);

    sendOtpNotification(user.phone, 'otp', 'sms', newOtp, user.firstName, 10).catch((e) =>
      console.error('[RESEND-OTP] Failed sending SMS:', e)
    );
    sendOtpNotification(user.email, 'otp', 'email', newOtp, user.firstName, 10).catch((e) =>
      console.error('[RESEND-OTP] Failed sending email:', e)
    );

    return res.json({ success: true, message: 'OTP resent to your email and phone' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
