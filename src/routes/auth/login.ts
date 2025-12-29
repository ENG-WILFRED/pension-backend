import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { comparePasswords, generateToken, verifyToken } from '../../lib/auth';
import { generateOtp } from '../../lib/otp';
import { sendOtpNotification } from '../../lib/notification';
import requireAuth, { AuthRequest } from '../../middleware/auth';
import { hashPassword } from '../../lib/auth';

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Start login — verify password and send OTP
 *     description: |
 *       Step 1 of a two-step authentication flow. The client POSTS an identifier and password.
 *       If the password is valid, the server generates a one-time code (OTP), stores it on the user,
 *       and sends the OTP via the Notification Service to the user's email. No token or user data
 *       is returned by this endpoint — tokens are issued only after OTP verification.
 *       If the `identifier` is a phone number the `password` field may alternatively contain a 4-digit PIN (digits only). PINs are stored hashed on the server and are valid only for phone-based login.
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
 *                 description: User's email or phone number
 *                 example: "+254712345678"
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       '200':
 *         description: OTP sent to user (acknowledgement)
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
 *                   example: "OTP sent to your email"
 *       '401':
 *         description: Invalid credentials
 *       '400':
 *         description: Bad request (validation error)
 *       '500':
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/auth/login/otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify OTP and complete login
 *     description: |
 *       Step 2 of login. Verifies the OTP sent to the user. For first-time logins where the
 *       account uses a temporary password, the client should include `newPassword` in the
 *       request to set a permanent password. If `newPassword` is omitted for a temporary
 *       account, the endpoint will respond with a `temporary: true` acknowledgement prompting
 *       the client to collect a new password and call the endpoint again with the same OTP.
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
 *                 description: User's email or phone number
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 description: Required only for first-time login when the account used a temporary password
 *     responses:
 *       '200':
 *         description: |
 *           Two possible successful outcomes:
 *           1) OTP valid and client should set a permanent password (temporary account).
 *           2) OTP validated and token + user data returned (login complete).
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     temporary:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "OTP valid. Please set a permanent password by providing `newPassword` in this endpoint."
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                     token:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       '401':
 *         description: Invalid OTP or credentials
 *       '400':
 *         description: Bad request (validation error)
 *       '500':
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/auth/set-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Set or change a permanent password (authenticated)
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
 *               pin:
 *                 type: string
 *                 description: Optional 4-digit PIN (digits only). If provided it will be stored hashed and can be used to login when using phone number.
 *                 example: "1234"
 *     responses:
 *       '200':
 *         description: Password set successfully
 *       '401':
 *         description: Unauthorized
                description: User's email or phone number
 *         description: Validation error
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
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
});

const otpLoginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  otp: z.string().min(4, 'OTP is required'),
});

const otpVerifySchema = otpLoginSchema.extend({
  newPassword: z.string().min(6).optional(),
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

    // Find user by email or phone
    const user = await prisma.user.findFirst({ where: [{ email: identifier }, { phone: identifier }] });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Verify password OR (when logging in with phone) 4-digit PIN
    let passwordMatch = false;
    const isPhoneLogin = user.phone && user.phone === identifier;

    // If identifier is phone and input looks like a 4-digit numeric PIN, try PIN compare
    if (isPhoneLogin && /^\d{4}$/.test(password) && user.pin) {
      passwordMatch = await comparePasswords(password, user.pin || '');
    }

    // Fallback to password compare (normal flow)
    if (!passwordMatch) {
      passwordMatch = await comparePasswords(password, user.password || '');
    }

    if (!passwordMatch) {
      // increment failed attempts
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const updates: any = { failedLoginAttempts: attempts };

      if (attempts >= 3) {
        // generate OTP, save and send via notification service (or fallback to SMTP)
        const otp = generateOtp(6);
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        updates.otpCode = otp;
        updates.otpExpiry = expiry;
        await prisma.user.update({ where: { id: user.id }, data: updates });
        // send OTP to user's email (fire-and-forget)
        sendOtpNotification(user.phone, 'otp', 'sms', otp, user.firstName, 10).catch((e) => console.error('Failed sending OTP notification', e));
        return res.status(403).json({ success: false, error: 'Too many failed attempts. An OTP has been sent to your registered email.' });
      }

      await prisma.user.update({ where: { id: user.id }, data: updates });
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // At this point password (or PIN) is valid. For both temporary and permanent-password users
    // we do not return token or user data yet. Instead generate a one-time code (OTP),
    // persist it and send it via the notification service. The client will call
    // POST /api/auth/login/otp to verify the code (and optionally set a permanent
    // password for first-time users) which will issue the token and return user data.

    const otp = generateOtp(6);
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { otpCode: otp, otpExpiry: expiry, failedLoginAttempts: 0 } });
    console.log(`Login OTP for user ${user.email}: ${otp} (expires ${expiry.toISOString()})`);
    sendOtpNotification(user.phone, 'otp', 'sms', otp, user.firstName, 10).catch((e) => console.error('Failed sending OTP on login', e));

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/login/otp - login using OTP sent to email
router.post('/login/otp', async (req: Request, res: Response) => {
  try {
    const validation = otpVerifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { identifier, otp, newPassword } = validation.data as { identifier: string; otp: string; newPassword?: string };
    const user = await prisma.user.findFirst({ where: [{ email: identifier }, { phone: identifier }] });
    if (!user || !user.otpCode) {
      return res.status(401).json({ success: false, error: 'Invalid OTP or credentials' });
    }

    if (user.otpExpiry && user.otpExpiry < new Date()) {
      return res.status(401).json({ success: false, error: 'OTP expired' });
    }

    if (user.otpCode !== otp) {
      return res.status(401).json({ success: false, error: 'Invalid OTP' });
    }

    // OTP valid — if user had a temporary password, prompt for permanent password
    if (user.passwordIsTemporary) {
      if (!newPassword) {
        // Do not clear the OTP yet. Prompt client to supply a newPassword in a
        // subsequent call to this endpoint along with the same OTP.
        return res.status(200).json({ success: true, temporary: true, message: 'OTP valid. Please set a permanent password by providing `newPassword` in this endpoint.' });
      }

      // user provided a new permanent password — set it and clear temporary flag
      const hashed = await hashPassword(newPassword);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed, passwordIsTemporary: false } });
    }

    // Clear OTP and failed attempts, then issue token and return user data
    await prisma.user.update({ where: { id: user.id }, data: { otpCode: null, otpExpiry: null, failedLoginAttempts: 0 } });
    const age = computeAge(user.dateOfBirth as any);
    const token = generateToken({ userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, age });
    res.json({ success: true, message: 'Login successful', token, user: { id: user.id, email: user.email, firstName: user.firstName, role: user.role, lastName: user.lastName } });
  } catch (error) {
    console.error('OTP login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/set-password - set a permanent password (requires auth)
router.post('/set-password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as any;
    if (!body || !body.password || typeof body.password !== 'string' || body.password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const userId = (req.user as any).userId;
    const updates: any = {};
    const hashed = await hashPassword(body.password);
    updates.password = hashed;
    updates.passwordIsTemporary = false;

    // Optional: set a 4-digit PIN (only digits allowed). Store hashed.
    if (body.pin !== undefined) {
      if (typeof body.pin !== 'string' || !/^\d{4}$/.test(body.pin)) {
        return res.status(400).json({ success: false, error: 'PIN must be a 4-digit string of digits' });
      }
      const hashedPin = await hashPassword(body.pin);
      updates.pin = hashedPin;
    }

    await prisma.user.update({ where: { id: userId }, data: updates });
    return res.json({ success: true, message: 'Password (and optional PIN) set successfully' });
  } catch (error) {
    console.error('Set password error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/auth/set-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Set or change a permanent password (authenticated)
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
 *               pin:
 *                 type: string
 *                 description: Optional 4-digit PIN (digits only). If provided it will be stored hashed and can be used to login when using phone number.
 *                 example: "1234"
 *     responses:
 *       '200':
 *         description: Password set successfully
 *       '401':
 *         description: Unauthorized
 *       '400':
 *         description: Validation error
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

// POST /api/auth/set-password - set a permanent password (requires auth)
router.post('/set-password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const body = req.body as any;
    if (!body || !body.password || typeof body.password !== 'string' || body.password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const userId = (req.user as any).userId;
    const updates: any = {};
    const hashed = await hashPassword(body.password);
    updates.password = hashed;
    updates.passwordIsTemporary = false;

    // Optional: set a 4-digit PIN (only digits allowed). Store hashed.
    if (body.pin !== undefined) {
      if (typeof body.pin !== 'string' || !/^\d{4}$/.test(body.pin)) {
        return res.status(400).json({ success: false, error: 'PIN must be a 4-digit string of digits' });
      }
      const hashedPin = await hashPassword(body.pin);
      updates.pin = hashedPin;
    }

    await prisma.user.update({ where: { id: userId }, data: updates });
    return res.json({ success: true, message: 'Password (and optional PIN) set successfully' });
  } catch (error) {
    console.error('Set password error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
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

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Resend OTP to user
 *     description: |
 *       Resends OTP to a user's registered email and phone.
 *       Validates that:
 *       1. User exists with the given identifier (email or phone)
 *       2. An OTP was previously generated for this user
 *       3. The OTP is not expired
 *       If all checks pass, a new OTP is generated and sent via the Notification Service
 *       to both email and SMS channels.
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
 *                 description: User's email or phone number
 *                 example: "+254712345678"
 *     responses:
 *       '200':
 *         description: OTP resent successfully
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
 *                   example: "OTP resent to your email and phone"
 *       '401':
 *         description: Invalid identifier or no OTP found
 *       '410':
 *         description: OTP has expired
 *       '400':
 *         description: Bad request (validation error)
 *       '500':
 *         description: Internal server error
 */

const resendOtpSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
});

router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const validation = resendOtpSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.issues[0].message,
      });
    }

    const { identifier } = validation.data;

    // Find user by email or phone
    const user = await prisma.user.findFirst({
      where: [{ email: identifier }, { phone: identifier }],
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found',
      });
    }

    // Check if user has a previously generated OTP
    if (!user.otpCode || !user.otpExpiry) {
      return res.status(401).json({
        success: false,
        error: 'No OTP found. Please initiate login first.',
      });
    }

    // Check if OTP is expired
    if (new Date() > user.otpExpiry) {
      return res.status(410).json({
        success: false,
        error: 'OTP has expired. Please initiate login again.',
      });
    }

    // Generate new OTP
    const newOtp = generateOtp(6);
    const newExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: newOtp, otpExpiry: newExpiry },
    });

    console.log(`Resend OTP for user ${user.email}: ${newOtp} (expires ${newExpiry.toISOString()})`);

    // Send OTP via email
    sendOtpNotification(user.email, 'otp', 'email', newOtp, user.firstName, 10).catch((e) =>
      console.error('Failed sending OTP via email', e)
    );

    // Send OTP via SMS
    sendOtpNotification(user.phone, 'otp', 'sms', newOtp, user.firstName, 10).catch((e) =>
      console.error('Failed sending OTP via SMS', e)
    );

    return res.json({
      success: true,
      message: 'OTP resent to your email and phone',
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
