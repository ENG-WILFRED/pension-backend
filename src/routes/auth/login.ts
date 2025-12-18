import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { comparePasswords, generateToken, verifyToken } from '../../lib/auth';
import { generateOtp, sendOtpEmail } from '../email/email';

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login with email/username and password
 *     description: Authenticates user with email or username and password. On 3 failed attempts, sends OTP to email.
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
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       '200':
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
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
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                     numberOfChildren:
 *                       type: number
 *       '401':
 *         description: Invalid credentials
 *       '403':
 *         description: Too many failed login attempts - OTP sent to email
 *       '500':
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/auth/login/otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login with OTP
 *     description: Login using OTP code sent to registered email after failed login attempts
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
 *                 example: user@example.com
 *               otp:
 *                 type: string
 *                 minLength: 4
 *                 example: "123456"
 *     responses:
 *       '200':
 *         description: OTP login successful
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
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       '401':
 *         description: Invalid OTP or credentials
 *       '500':
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Verify JWT token
 *     description: Verifies the validity of a JWT token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   type: object
 *       '401':
 *         description: Invalid or missing token
 *       '500':
 *         description: Internal server error
 */

const router = Router();

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

const otpLoginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  otp: z.string().min(4, 'OTP is required'),
});

function computeAge(dob?: string | null): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const diff = Date.now() - d.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.issues[0].message,
      });
    }

    const { identifier, password } = validation.data;

    // Find user by email or username
    const user = await prisma.user.findFirst({ where: [{ email: identifier }, { username: identifier }] });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Verify password
    const passwordMatch = await comparePasswords(password, user.password);
    if (!passwordMatch) {
      // increment failed attempts
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const updates: any = { failedLoginAttempts: attempts };

      if (attempts >= 3) {
        // generate OTP, save and send
        const otp = generateOtp(6);
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        updates.otpCode = otp;
        updates.otpExpiry = expiry;
        await prisma.user.update({ where: { id: user.id }, data: updates });
        // send OTP to user's email (fire-and-forget)
        sendOtpEmail(user.email, otp, user.firstName, 10).catch((e) => console.error('Failed sending OTP email', e));
        return res.status(403).json({ success: false, error: 'Too many failed attempts. An OTP has been sent to your registered email.' });
      }

      await prisma.user.update({ where: { id: user.id }, data: updates });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const age = computeAge(user.dateOfBirth as any);
    // reset failed attempts and clear otp
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, otpCode: null, otpExpiry: null } });
    const token = generateToken({ userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, age });

    res.json({ success: true, token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, dateOfBirth: user.dateOfBirth, numberOfChildren: user.numberOfChildren } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/login/otp - login using OTP sent to email
router.post('/login/otp', async (req: Request, res: Response) => {
  try {
    const validation = otpLoginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { identifier, otp } = validation.data;
    const user = await prisma.user.findFirst({ where: [{ email: identifier }, { username: identifier }] });
    if (!user || !user.otpCode) {
      return res.status(401).json({ success: false, error: 'Invalid OTP or credentials' });
    }

    if (user.otpExpiry && user.otpExpiry < new Date()) {
      return res.status(401).json({ success: false, error: 'OTP expired' });
    }

    if (user.otpCode !== otp) {
      return res.status(401).json({ success: false, error: 'Invalid OTP' });
    }

    // OTP valid — clear and authenticate
    await prisma.user.update({ where: { id: user.id }, data: { otpCode: null, otpExpiry: null, failedLoginAttempts: 0 } });
    const age = computeAge(user.dateOfBirth as any);
    const token = generateToken({ userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, age });
    res.json({ success: true, message: 'Login successful', token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  } catch (error) {
    console.error('OTP login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/auth/verify
router.get('/verify', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    res.json({ success: true, user: payload });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
