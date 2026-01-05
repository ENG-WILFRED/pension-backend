
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import { randomUUID } from 'crypto';
import { hashPassword } from '../../lib/auth';
import axios from 'axios';
import AppDataSource from '../../lib/data-source';
import { Account } from '../../entities/Account';

// Poll payment gateway /health until it returns { status: 'ok' } or timeout
async function waitForPaymentGatewayHealth(baseUrl: string, timeoutMs = 60_000, intervalMs = 1000): Promise<boolean> {
  const start = Date.now();
  const healthUrl = `${baseUrl.replace(/\/$/, '')}/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await axios.get(healthUrl, { timeout: 5000 });
      if (resp && resp.data && resp.data.status === 'ok') {
        return true;
      }
    } catch (e) {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

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
 *               - phone
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               phone:
 *                 type: string
 *                 example: '+254712345678'
 *               pin:
 *                 type: string
 *                 description: Optional 4-digit PIN for phone-based login
 *                 example: '1234'
 *                 minLength: 4
 *                 maxLength: 4
 *               bankAccountName:
 *                 type: string
 *                 description: Optional bank account name for the user
 *                 example: "John Doe"
 *               bankAccountNumber:
 *                 type: string
 *                 description: Optional bank account number (customer bank account)
 *                 example: "1234567890"
 *               bankBranchName:
 *                 type: string
 *                 description: Optional bank branch name
 *                 example: "Nairobi - West"
 *               bankBranchCode:
 *                 type: string
 *                 description: Optional bank branch code
 *                 example: "011"
 *               bankName:
 *                 type: string
 *                 description: Optional bank name for the customer's bank (e.g. Equity, KCB)
 *                 example: "Equity"
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
 *               accountType:
 *                 type: string
 *                 enum: [MANDATORY, VOLUNTARY, EMPLOYER, SAVINGS, WITHDRAWAL, BENEFITS]
 *                 default: MANDATORY
 *                 example: MANDATORY
 *               riskProfile:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *                 default: MEDIUM
 *                 example: MEDIUM
 *               currency:
 *                 type: string
 *                 default: KES
 *                 example: KES
 *                 minLength: 3
 *                 maxLength: 3
 *               accountStatus:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, CLOSED, FROZEN, DECEASED]
 *                 default: ACTIVE
 *                 example: ACTIVE
 *               kycVerified:
 *                 type: boolean
 *                 default: false
 *                 example: false
 *               complianceStatus:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED, SUSPENDED]
 *                 default: PENDING
 *                 example: PENDING
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
 *     description: Poll this endpoint to check if payment was completed. On successful payment, automatically completes registration, creates a default pension account (MANDATORY type), and returns JWT token + account details
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
 *                     account:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                           description: Auto-created default pension account ID
 *                         accountNumber:
 *                           type: string
 *                         accountType:
 *                           type: string
 *                           example: MANDATORY
 *                         accountStatus:
 *                           type: string
 *                           example: ACTIVE
 *                         riskProfile:
 *                           type: string
 *                           example: MEDIUM
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
  accountType: z.enum(['MANDATORY', 'VOLUNTARY', 'EMPLOYER', 'SAVINGS', 'WITHDRAWAL', 'BENEFITS']).optional().default('MANDATORY'),
  riskProfile: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
  currency: z.string().length(3).optional().default('KES'),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED', 'FROZEN', 'DECEASED']).optional().default('ACTIVE'),
  kycVerified: z.boolean().optional().default(false),
  complianceStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional().default('PENDING'),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits').optional(),
  // Optional bank details
  bankAccountName: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankBranchName: z.string().optional(),
  bankBranchCode: z.string().optional(),
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
      const issues = validation.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        issues,
      });
    }

    const {
      email,
      phone,
      firstName,
      lastName,
      pin,
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
      accountType,
      riskProfile,
      currency,
      accountStatus,
      kycVerified,
      complianceStatus,
      bankAccountName,
      bankName,
      bankAccountNumber,
      bankBranchName,
      bankBranchCode,
    } = validation.data;

    // Check if user already exists by email or phone
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) return res.status(409).json({ success: false, error: 'Email already registered', field: 'email' });
    const existingByPhone = (await prisma.user.findMany({ where: { phone } }))?.[0];
    if (existingByPhone) return res.status(409).json({ success: false, error: 'Phone number already registered', field: 'phone' });
    // Check if user already exists by email or phone

    // Initiate M-Pesa STK Push payment
    try {
      const paymentGatewayBase = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_URL || 'http://localhost:3001';

      // Wait up to 60s for payment gateway health to be OK before initiating checkout
      const healthy = await waitForPaymentGatewayHealth(paymentGatewayBase, 60_000, 1000);
      if (!healthy) {
        console.error('[Register] Payment gateway health check failed after timeout');
        return res.status(503).json({ success: false, error: 'Payment gateway unavailable. Please try again later.' });
      }

      const mpesaInitiateUrl = `${paymentGatewayBase}/payments/mpesa/initiate`;
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

        // If user supplied a 4-digit PIN at registration, hash and persist it in metadata
        let hashedPin: string | null = null;
        if (validation.data.pin) {
          try {
            hashedPin = await hashPassword(validation.data.pin);
          } catch (e) {
            console.error('[Register] Failed hashing PIN:', e);
            hashedPin = null;
          }
        }

        const transaction = await prisma.transaction.create({
          data: {
            amount: 1,
            checkoutRequestId: checkoutId,
            status: 'pending',
            type: 'registration',
            metadata: {
              email,
              hashedTemporaryPassword: hashedTempPassword,
              temporaryPasswordPlain: tempPassword,
              hashedPin,
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
                accountType,
                riskProfile,
                currency,
                accountStatus,
                kycVerified,
                complianceStatus,
                bankAccountName,
                bankName,
                bankAccountNumber,
                bankBranchName,
                bankBranchCode,
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
        accountType,
        riskProfile,
        currency,
        accountStatus,
        bankAccountName,
        bankName,
        bankAccountNumber,
        bankBranchName,
        bankBranchCode,
        kycVerified,
        complianceStatus,
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
            // Set hashed PIN if provided during registration
            ...(metadata.hashedPin ? { pin: metadata.hashedPin } : {}),
          },
        });
      }

      // Link transaction to user
      await prisma.transaction.update({ where: { id: transactionId }, data: { userId: user.id } });

      // Auto-create default pension account for new user
      let createdAccount: any = null;
      try {
        const accountRepo = AppDataSource.getRepository(Account);
        // Create account without accountNumber so we can obtain numeric id
        const account = accountRepo.create({
          userId: user.id,
          accountType,
          accountStatus,
          riskProfile,
          currency,
          openedAt: new Date(),
          currentBalance: 0,
          availableBalance: 0,
          lockedBalance: 0,
          kycVerified,
          complianceStatus,
          // bank details (optional)
          bankAccountName: bankAccountName ?? null,
          bankName: bankName ?? null,
          // bankAccountNumber is the customer's bank account; pension accountNumber is generated below
          bankAccountNumber: bankAccountNumber ?? null,
          bankBranchName: bankBranchName ?? null,
          bankBranchCode: bankBranchCode ?? null,
        });
        // Save to obtain numeric auto-increment id
        createdAccount = await accountRepo.save(account);
        // If no accountNumber was provided, set accountNumber as zero-padded 8-digit string from id
        if (!createdAccount.accountNumber) {
          const padded = String(createdAccount.id).padStart(8, '0');
          createdAccount.accountNumber = padded;
          await accountRepo.save(createdAccount);
        }
        console.log('[Register] Auto-created default pension account for user', user.id);
      } catch (accountError) {
        console.error('[Register] Failed to auto-create account:', accountError);
        // Don't fail registration if account creation fails
      }

      // Send temporary password to user via both email and SMS
      try {
        const { notify } = await import('../../lib/notification');
        if (temporaryPasswordPlain) {
            // Send SMS and Email with temporary password, include account number if available
            try {
              const notificationDataBase: any = {
                name: firstName || 'User',
                temp_password: temporaryPasswordPlain,
                link: "https://transactions-k6gk.onrender.com/login",
                account_number: createdAccount?.accountNumber || null
              };
              await notify({
                to: email,
                channel: 'email',
                template: 'welcome',
                data: notificationDataBase,
              });
              await notify({
                to: phone,
                channel: 'sms',
                template: 'welcome',
                data: notificationDataBase,
              });
              console.log('[Register] Sent SMS with temporary password to', phone);
            } catch (smsError) {
              console.error('[Register] Failed sending SMS notification:', smsError);
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
        ...(createdAccount && {
          account: {
            id: createdAccount.id,
            accountNumber: createdAccount.accountNumber,
            accountType: createdAccount.accountType,
            accountStatus: createdAccount.accountStatus,
            riskProfile: createdAccount.riskProfile,
          },
        }),
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
