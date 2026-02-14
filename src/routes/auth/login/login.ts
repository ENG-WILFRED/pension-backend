import { Router, Request, Response } from 'express';
import prisma from '../../../lib/prisma';
import redis from '../../../lib/redis';
import { comparePasswords, generateToken } from '../../../lib/auth';
import { generateOtp } from '../../../lib/otp';
import { sendOtpNotification } from '../../../lib/notification';
import { loginSchema } from './schemas';

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Initiate login and generate OTP
 *     description: Send OTP to user's email and phone for login verification. Supports email or phone number as identifier and password or 4-digit PIN for phone-based logins.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - identifier
 *               - password
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: User email or phone number
 *               password:
 *                 type: string
 *                 description: User password or 4-digit PIN (for phone-based login)
 *           example:
 *             identifier: "john.doe@example.com"
 *             password: "password123"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *       403:
 *         description: Too many failed login attempts - OTP sent
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
// POST /api/auth/login - Generate and send OTP
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { identifier, password } = validation.data;
    const user = await prisma.user.findFirst({ where: [{ email: identifier }, { phone: identifier }] });
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Verify password OR 4-digit PIN (if phone login)
    let passwordMatch = false;
    const isPhoneLogin = user.phone && user.phone === identifier;

    if (isPhoneLogin && /^\d{4}$/.test(password) && user.pin) {
      passwordMatch = await comparePasswords(password, user.pin);
    }

    if (!passwordMatch) {
      passwordMatch = await comparePasswords(password, user.password || '');
    }

    if (!passwordMatch) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const updates: any = { failedLoginAttempts: attempts };

      if (attempts >= 3) {
        const otp = generateOtp(6);
        // Store OTP in Redis with 10 minute expiry
        await redis.set(`otp:${user.id}`, otp, { EX: 600 });
        await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts } });
        sendOtpNotification(user.phone, 'otp', 'sms', otp, user.firstName, 10).catch((e) =>
          console.error('Failed sending OTP via SMS', e)
        );
        sendOtpNotification(user.email, 'otp', 'email', otp, user.firstName, 10).catch((e) =>
          console.error('Failed sending OTP via email', e)
        );
        return res.status(403).json({ success: false, error: 'Too many failed attempts. An OTP has been sent to your registered email and phone.' });
      }

      await prisma.user.update({ where: { id: user.id }, data: updates });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Generate OTP (valid for 10 minutes)
    const otp = generateOtp(6);
    // Store OTP in Redis instead of database
    await redis.set(`otp:${user.id}`, otp, { EX: 600 });
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0 } });
    console.log(`[LOGIN] OTP for ${user.email}: ${otp}`);

    sendOtpNotification(user.phone, 'otp', 'sms', otp, user.firstName, 10).catch((e) =>
      console.error('[LOGIN] Failed sending SMS:', e)
    );
    sendOtpNotification(user.email, 'otp', 'email', otp, user.firstName, 10).catch((e) =>
      console.error('[LOGIN] Failed sending email:', e)
    );

    return res.json({ success: true, message: 'OTP sent to your email and phone' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
