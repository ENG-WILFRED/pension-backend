import { Router, Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { comparePasswords } from '../../lib/auth';
import { generateOtp } from '../../lib/otp';
import { sendOtpNotification } from '../../lib/notification';
import requireAuth, { AuthRequest } from '../../middleware/auth';
import { hashPassword } from '../../lib/auth';

/**
 * @swagger
 * /api/auth/change-pin:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Change PIN (authenticated)
 *     description: Change the user's 4-digit PIN by verifying the existing PIN.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPin
 *               - newPin
 *             properties:
 *               currentPin:
 *                 type: string
 *                 description: Current 4-digit PIN
 *               newPin:
 *                 type: string
 *                 description: New 4-digit PIN (digits only)
 *     responses:
 *       '200':
 *         description: PIN changed successfully
 *       '400':
 *         description: Invalid input or incorrect current PIN
 *       '401':
 *         description: Unauthorized or PIN not set
 *       '500':
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/auth/reset-pin:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request PIN reset OTP
 *     description: Send OTP to user's phone for PIN reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+254712345678"
 *     responses:
 *       '200':
 *         description: OTP sent to phone via SMS
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/auth/reset-pin/verify:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Verify OTP and reset PIN
 *     description: Verify the OTP sent to phone and set a new 4-digit PIN
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *               - newPin
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *                 minLength: 6
 *               newPin:
 *                 type: string
 *                 description: New 4-digit PIN (digits only)
 *     responses:
 *       '200':
 *         description: PIN reset successfully
 *       '400':
 *         description: Invalid input or PIN format
 *       '401':
 *         description: OTP expired or invalid
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/auth/set-pin:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Set PIN directly
 *     description: Set a new 4-digit PIN using phone number. No authentication or OTP required.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - newPin
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+254712345678"
 *               newPin:
 *                 type: string
 *                 description: New 4-digit PIN (digits only)
 *                 example: "1234"
 *     responses:
 *       '200':
 *         description: PIN set successfully
 *       '400':
 *         description: Invalid PIN format or missing fields
 *       '404':
 *         description: User not found
 *       '500':
 *         description: Internal server error
 */

const router = Router();

// POST /api/auth/set-pin - Set PIN directly (no auth, no OTP)
router.post('/set-pin', async (req: Request, res: Response) => {
  try {
    const { phone, newPin } = req.body;
    if (!phone || !newPin || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ success: false, error: 'Phone and new PIN (4 digits) are required' });
    }

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Check if PIN is already set
    if (user.pin) {
      return res.status(400).json({ success: false, error: 'PIN already exists. Try to change PIN instead.' });
    }

    // Hash and set the PIN directly
    const hashed = await hashPassword(newPin);
    await prisma.user.update({ 
      where: { id: user.id }, 
      data: { pin: hashed } 
    });

    return res.json({ success: true, message: 'PIN set successfully' });
  } catch (error) {
    console.error('Set PIN error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/change-pin', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPin, newPin } = req.body;
    if (!currentPin || !newPin || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ success: false, error: 'Current PIN and new PIN (4 digits) are required' });
    }

    const userId = (req.user as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.pin) return res.status(401).json({ success: false, error: 'PIN not set on account' });

    // Verify current PIN
    const match = await comparePasswords(currentPin, user.pin);
    if (!match) return res.status(400).json({ success: false, error: 'Current PIN is incorrect' });

    const hashed = await hashPassword(newPin);
    await prisma.user.update({ where: { id: userId }, data: { pin: hashed } });
    return res.json({ success: true, message: 'PIN changed successfully' });
  } catch (error) {
    console.error('Change PIN error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/reset-pin - unauthenticated
router.post('/reset-pin', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone is required' });

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Generate OTP and save
    const otp = generateOtp(6);
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { otpCode: otp, otpExpiry: expiry } });
    console.log(`[Reset PIN] OTP for user ${phone}: ${otp} (expires ${expiry.toISOString()})`);

    // Send OTP via notification service using pin-reset template to SMS
    sendOtpNotification(user.phone, 'pin-reset', 'sms', otp, user.firstName, 10).catch((e) =>
      console.error('[Reset PIN] Failed sending OTP notification:', e)
    );

    return res.json({ success: true, message: 'OTP sent to your phone' });
  } catch (error) {
    console.error('Reset PIN error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/reset-pin/verify - unauthenticated
router.post('/reset-pin/verify', async (req: Request, res: Response) => {
  try {
    const { phone, otp, newPin } = req.body;
    if (!phone || !otp || !newPin || !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ success: false, error: 'Phone, OTP, and new PIN (4 digits) are required' });
    }

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user || !user.otpCode) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    if (user.otpExpiry && user.otpExpiry < new Date()) {
      return res.status(401).json({ success: false, error: 'OTP expired' });
    }

    if (user.otpCode !== otp) return res.status(401).json({ success: false, error: 'Invalid OTP' });

    // OTP valid — set new PIN and clear OTP
    const hashed = await hashPassword(newPin);
    await prisma.user.update({ where: { id: user.id }, data: { pin: hashed, otpCode: null, otpExpiry: null } });
    return res.json({ success: true, message: 'PIN reset successfully' });
  } catch (error) {
    console.error('Reset PIN verify error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
