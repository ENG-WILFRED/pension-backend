import { Router, Request, Response } from 'express';
import prisma from '../../../lib/prisma';
import { comparePasswords, generateToken, verifyToken, hashPassword } from '../../../lib/auth';
import { generateOtp } from '../../../lib/otp';
import { sendOtpNotification } from '../../../lib/notification';
import requireAuth, { AuthRequest } from '../../../middleware/auth';
import { loginSchema, otpVerifySchema, setPasswordSchema } from './schemas';
import { computeAge } from '../utils';

const router = Router();

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
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
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
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        updates.otpCode = otp;
        updates.otpExpiry = expiry;
        await prisma.user.update({ where: { id: user.id }, data: updates });
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
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { otpCode: otp, otpExpiry: expiry, failedLoginAttempts: 0 } });
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

// POST /api/auth/login/otp - Verify OTP and issue token
router.post('/login/otp', async (req: Request, res: Response) => {
  try {
    const validation = otpVerifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { identifier, otp, newPassword } = validation.data;
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

    // Clear OTP and issue token
    await prisma.user.update({ where: { id: user.id }, data: { otpCode: null, otpExpiry: null, failedLoginAttempts: 0 } });
    const age = computeAge(user.dateOfBirth as any);
    const token = generateToken({ userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, age });
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

// GET /api/auth/verify - Verify JWT token
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

    if (!user || !user.otpCode || !user.otpExpiry) {
      return res.status(401).json({ success: false, error: 'No OTP found. Please initiate login first.' });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(410).json({ success: false, error: 'OTP has expired. Please initiate login again.' });
    }

    const newOtp = generateOtp(6);
    const newExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { otpCode: newOtp, otpExpiry: newExpiry } });
    console.log(`[RESEND-OTP] New OTP for ${user.email}: ${newOtp}`);

    sendOtpNotification(user.email, 'otp', 'email', newOtp, user.firstName, 10).catch((e) =>
      console.error('[RESEND-OTP] Failed sending email:', e)
    );
    sendOtpNotification(user.phone, 'otp', 'sms', newOtp, user.firstName, 10).catch((e) =>
      console.error('[RESEND-OTP] Failed sending SMS:', e)
    );

    return res.json({ success: true, message: 'OTP resent to your email and phone' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
