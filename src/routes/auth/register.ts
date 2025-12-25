import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { randomUUID } from 'crypto';
import { hashPassword } from '../../lib/auth';
import axios from 'axios';

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user with M-Pesa payment initiation
 *     description: Creates a pending registration transaction and initiates M-Pesa payment for registration fee (1 KES). A temporary password will be sent to the user via email and SMS after registration is completed.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - username
 *               - phone
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               username:
 *                 type: string
 *                 minLength: 1
 *                 example: john_doe
 *               phone:
 *                 type: string
 *                 example: '+254712345678'
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *               maritalStatus:
 *                 type: string
 *               spouseName:
 *                 type: string
 *               spouseDob:
 *                 type: string
 *                 format: date
 *               children:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     dob:
 *                       type: string
 *                       format: date
 *               nationalId:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               country:
 *                 type: string
 *               occupation:
 *                 type: string
 *               employer:
 *                 type: string
 *               salary:
 *                 type: number
 *               contributionRate:
 *                 type: number
 *               retirementAge:
 *                 type: number
 *     responses:
 *       '200':
 *         description: Payment initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: payment_initiated
 *                 message:
 *                   type: string
 *                 transactionId:
 *                   type: string
 *                 checkoutRequestId:
 *                   type: string
 *                 statusCheckUrl:
 *                   type: string
 *       '400':
 *         description: Bad request - validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *       '500':
 *         description: Payment initiation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /api/auth/register/status/{transactionId}:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Check registration payment status
 *     description: Poll this endpoint to check if payment was completed. On successful payment, automatically completes registration and returns JWT token
 *     parameters:
 *       - name: transactionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID from the registration initiation
 *     responses:
 *       '200':
 *         description: Status check successful
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     status:
 *                       type: string
 *                       enum: [payment_pending]
 *                     message:
 *                       type: string
 *                     transactionId:
 *                       type: string
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     status:
 *                       type: string
 *                       enum: [registration_completed]
 *                     message:
 *                       type: string
 *                     token:
 *                       type: string
 *                       description: JWT authentication token
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         dateOfBirth:
 *                           type: string
 *                         numberOfChildren:
 *                           type: number
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     status:
 *                       type: string
 *                       enum: [payment_failed]
 *                     error:
 *                       type: string
 *                     transactionId:
 *                       type: string
 *       '404':
 *         description: Transaction not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 */

const router = Router();

const childSchema = z.object({
  name: z.string().optional(),
  dob: z.string().optional(),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string().min(1, 'Username is required'),
  phone: z.string().min(1, 'Phone number is required for payment'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  spouseName: z.string().optional(),
  spouseDob: z.string().optional(),
  children: z.array(childSchema).optional(),
  nationalId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  salary: z.number().optional(),
  contributionRate: z.number().optional(),
  retirementAge: z.number().optional(),
});

function computeAge(dob?: string | null): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const diff = Date.now() - d.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.issues[0].message,
      });
    }

    const {
      email,
      username,
      phone,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      maritalStatus,
      spouseName,
      spouseDob,
      children,
      nationalId,
      address,
      city,
      country,
      occupation,
      employer,
      salary,
      contributionRate,
      retirementAge,
    } = validation.data;

    // Check if user already exists by email or username
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) return res.status(400).json({ success: false, error: 'Email already registered' });
    const existingByUsername = (await prisma.user.findMany({ where: { username } }))?.[0];
    if (existingByUsername) return res.status(400).json({ success: false, error: 'Username already taken' });
    const existingByPhone = (await prisma.user.findMany({ where: { phone } }))?.[0];
    if (existingByPhone) return res.status(400).json({ success: false, error: 'Phone number already registered' });

    // Initiate M-Pesa STK Push payment
    try {
      const mpesaInitiateUrl = `${process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_URL || 'http://localhost:3001'}/payments/mpesa/initiate`;
      const mpesaResponse = await axios.post(mpesaInitiateUrl, {
        phone,
        amount: 1,
        referenceId: `Ref-${email}`,
        accountReference: `REG-${email}`,
        transactionDesc: 'Registration Fee',
        stkCallback: `${process.env.BACKEND_URL}/api/payment/callback`,
      });
      if (mpesaResponse) {
        // Ensure we always persist a checkoutRequestId value in the DB. Use provider value when present,
        // otherwise generate a stable fallback id.
        const providerCheckoutId = mpesaResponse.data.data.CheckoutRequestID;
        const checkoutId = providerCheckoutId ?? `CRID-${randomUUID()}`;

        // Create a pending registration transaction with 1 KES amount and persist checkoutId
        // generate a temporary password and store its hash in metadata
        const tempPassword = Math.random().toString(36).slice(2, 10); // 8 char temporary password
        const hashedTempPassword = await hashPassword(tempPassword);

        const transaction = await prisma.transaction.create({
          data: {
            amount: 1,
            checkoutRequestId: checkoutId,
            status: 'pending',
            type: 'registration',
            metadata: {
              email,
              username,
              hashedTemporaryPassword: hashedTempPassword,
              temporaryPasswordPlain: tempPassword,
              phone,
              firstName,
              lastName,
              dateOfBirth,
              gender,
              maritalStatus,
              spouseName,
              spouseDob,
              children,
              nationalId,
              address,
              city,
              country,
              occupation,
              employer,
              salary,
              contributionRate,
              retirementAge,
            },
          },
        });

        // Confirm the value was saved and log it for debugging
        const saved = await prisma.transaction.findUnique({ where: { id: transaction.id } });
        console.log('[Register] Created transaction', { id: transaction.id, checkoutRequestId: saved?.checkoutRequestId });

        return res.json({
          success: true,
          status: 'payment_initiated',
          message: 'Payment initiated. Please check your phone for the M-Pesa prompt.',
          transactionId: transaction.id,
          checkoutRequestId: checkoutId,
          statusCheckUrl: `/api/auth/register/status/${transaction.id}`,
        });
      }
    } catch (paymentError) {
      console.error('M-Pesa initiation error:', paymentError);
      // Still return success but note that payment initiation failed
      return res.status(500).json({
        success: false,
        error: 'Failed to initiate payment. Please try again.',
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/auth/register/status/:transactionId
// Frontend polls this endpoint to check if payment was completed
router.get('/register/status/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // If payment completed, automatically complete registration
    if (transaction.status === 'completed' && transaction.type === 'registration') {
      const metadata = (transaction.metadata ?? {}) as any;
      const {
        email,
        username,
        hashedTemporaryPassword,
        temporaryPasswordPlain,
        firstName,
        lastName,
        phone,
        dateOfBirth,
        gender,
        maritalStatus,
        spouseName,
        spouseDob,
        children,
        nationalId,
        address,
        city,
        country,
        occupation,
        employer,
        salary,
        contributionRate,
        retirementAge,
      } = metadata;

      if (!email || !hashedTemporaryPassword) {
        return res.status(400).json({
          success: false,
          status: 'payment_completed',
          error: 'Missing registration metadata',
        });
      }

      // Compute derived values
      const numberOfChildren = Array.isArray(children) ? children.length : 0;

      // Create user if doesn't exist
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            username,
            password: hashedTemporaryPassword,
            passwordIsTemporary: true,
            firstName,
            lastName,
            phone,
            dateOfBirth: dateOfBirth || null,
            gender: gender || null,
            maritalStatus: maritalStatus || null,
            spouseName: spouseName || null,
            spouseDob: spouseDob || null,
            children: children || null,
            numberOfChildren: numberOfChildren || null,
            nationalId: nationalId || null,
            address: address || null,
            city: city || null,
            country: country || null,
            occupation: occupation || null,
            employer: employer || null,
            salary: salary || null,
            contributionRate: contributionRate || null,
            retirementAge: retirementAge || null,
            // Ensure new registrations are customers by default
            role: 'customer',
          },
        });
      }

      // Link transaction to user
      await prisma.transaction.update({ where: { id: transactionId }, data: { userId: user.id } });

      // Send temporary password to user via both email and SMS
      try {
        const { notify } = await import('../../lib/notification');
        if (temporaryPasswordPlain) {
          // Send SMS with temporary password
          try {
            await notify({
              to: email,
              channel: 'email',
              template: 'welcome',
              data: {
                name: firstName || 'User',
                temp_password: temporaryPasswordPlain,
                link: "https://transactions-k6gk.onrender.com/login"
              },
            });
            await notify({
              to: phone,
              channel: 'sms',
              template: 'welcome',
              data: {
                name: firstName || 'User',
                temp_password: temporaryPasswordPlain,
                link: "https://transactions-k6gk.onrender.com/login"
              },
            });
            console.log('[Register] Sent SMS with temporary password to', phone);
          } catch (smsError) {
            console.error('[Register] Failed sending SMS notification:', smsError);
          }

          // Send Email with temporary password
          try {
            await notify({
              to: email,
              channel: 'email',
              template: 'welcome',
              data: {
                name: firstName || 'User',
                temporaryPassword: temporaryPasswordPlain,
                username,
              },
            });
            console.log('[Register] Sent email with temporary password to', email);
          } catch (emailError) {
            console.error('[Register] Failed sending email notification:', emailError);
          }
        }
      } catch (e) {
        console.error('[Register] Failed sending notifications:', e);
      }

      // Generate token
      const { generateToken } = await import('../../lib/auth');
      const age = computeAge(user.dateOfBirth as any);
      const token = generateToken({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        age,
      });

      return res.json({
        success: true,
        status: 'registration_completed',
        message: 'Registration completed successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          dateOfBirth: user.dateOfBirth,
          numberOfChildren: user.numberOfChildren,
        },
      });
    }

    // Payment still pending
    if (transaction.status === 'pending') {
      return res.json({
        success: true,
        status: 'payment_pending',
        message: 'Waiting for payment confirmation...',
        transactionId: transaction.id,
      });
    }

    // Payment failed
    if (transaction.status === 'failed') {
      return res.json({
        success: false,
        status: 'payment_failed',
        error: 'Payment failed. Please try again.',
        transactionId: transaction.id,
      });
    }

    res.json({
      success: true,
      status: transaction.status,
      transactionId: transaction.id,
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
