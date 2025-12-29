import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { comparePasswords, generateToken } from '../../lib/auth';


/**
 * @swagger
 * /api/auth/ussd-login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: USSD login using phone and PIN (no OTP)
 *     description: |
 *       Login endpoint for USSD clients. The caller provides a phone number and a 4-digit PIN.
 *       If the PIN matches the stored hashed PIN, the endpoint returns an authentication token
 *       and basic user information — no OTP is required for this flow.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - pin
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number
 *                 example: "+254712345678"
 *               pin:
 *                 type: string
 *                 description: 4-digit numeric PIN
 *                 example: "1234"
 *     responses:
 *       '200':
 *         description: Login successful — token and user returned
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
 *                 user:
 *                   type: object
 *       '401':
 *         description: Invalid credentials or PIN not set
 *       '400':
 *         description: Validation error
 *       '500':
 *         description: Internal server error
 */

const router = Router();

const ussdSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
});

function computeAge(dob?: string | null): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const diff = Date.now() - d.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

router.post('/ussd-login', async (req: Request, res: Response) => {
  try {
    const validation = ussdSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { phone, pin } = validation.data;

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (!user.pin) {
      return res.status(401).json({ success: false, error: 'PIN not set for this user' });
    }

    const match = await comparePasswords(pin, user.pin || '');
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Successful USSD login — issue token and return user data (same shape as OTP-verify success)
    const age = computeAge(user.dateOfBirth as any);
    const token = generateToken({ userId: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, age });

    return res.json({ success: true, message: 'Login successful', token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } });
  } catch (error) {
    console.error('USSD login error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
