import { Router, Request, Response } from 'express';
import axios from 'axios';
import prisma from '../../../lib/prisma';
import AppDataSource from '../../../lib/data-source';
import { Account } from '../../../entities/Account';
import { hashPassword, generateToken } from '../../../lib/auth';
import { randomUUID } from 'crypto';
import { registerSchema } from './schemas';
import { createUserWithAccount, sendWelcomeNotifications } from './services';
import { computeAge, waitForPaymentGatewayHealth } from '../utils';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user with M-Pesa payment initiation
 *     description: Creates a pending registration transaction and initiates M-Pesa payment for registration fee (1 KES).
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
 *                 description: User email address
 *               phone:
 *                 type: string
 *                 description: User phone number (required for M-Pesa payment)
 *               firstName:
 *                 type: string
 *                 description: User first name
 *               lastName:
 *                 type: string
 *                 description: User last name
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: User date of birth (YYYY-MM-DD format)
 *               gender:
 *                 type: string
 *                 enum: ['Male', 'Female', 'Other']
 *                 description: User gender
 *               maritalStatus:
 *                 type: string
 *                 enum: ['Single', 'Married', 'Divorced', 'Widowed']
 *                 description: User marital status
 *               spouseName:
 *                 type: string
 *                 description: Spouse name
 *               spouseDob:
 *                 type: string
 *                 format: date
 *                 description: Spouse date of birth (YYYY-MM-DD format)
 *               children:
 *                 type: array
 *                 description: Array of children
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: Child name
 *                     dob:
 *                       type: string
 *                       format: date
 *                       description: Child date of birth (YYYY-MM-DD format)
 *               nationalId:
 *                 type: string
 *                 description: User national ID
 *               address:
 *                 type: string
 *                 description: User residential address
 *               city:
 *                 type: string
 *                 description: User city
 *               country:
 *                 type: string
 *                 description: User country
 *               occupation:
 *                 type: string
 *                 description: User occupation
 *               employer:
 *                 type: string
 *                 description: User employer name
 *               salary:
 *                 type: number
 *                 description: User annual salary
 *               contributionRate:
 *                 type: number
 *                 description: Contribution rate percentage
 *               retirementAge:
 *                 type: number
 *                 description: Intended retirement age
 *               accountType:
 *                 type: string
 *                 enum: ['MANDATORY', 'VOLUNTARY', 'EMPLOYER', 'SAVINGS', 'WITHDRAWAL', 'BENEFITS']
 *                 default: MANDATORY
 *                 description: Type of account
 *               riskProfile:
 *                 type: string
 *                 enum: ['LOW', 'MEDIUM', 'HIGH']
 *                 default: MEDIUM
 *                 description: Investment risk profile
 *               currency:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 3
 *                 default: KES
 *                 description: Currency code (ISO 4217)
 *               accountStatus:
 *                 type: string
 *                 enum: ['ACTIVE', 'SUSPENDED', 'CLOSED', 'FROZEN', 'DECEASED']
 *                 default: ACTIVE
 *                 description: Initial account status
 *               kycVerified:
 *                 type: boolean
 *                 default: false
 *                 description: KYC verification status
 *               complianceStatus:
 *                 type: string
 *                 enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']
 *                 default: PENDING
 *                 description: Compliance check status
 *               pin:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 4
 *                 description: 4-digit PIN for the account
 *           example:
 *             email: john.doe@example.com
 *             phone: "254793056960"
 *             firstName: John
 *             lastName: Doe
 *             dateOfBirth: "1990-05-15"
 *             gender: Male
 *             maritalStatus: Married
 *             spouseName: Jane Doe
 *             spouseDob: "1992-08-20"
 *             children:
 *               - name: Jack Doe
 *                 dob: "2015-03-10"
 *               - name: Jill Doe
 *                 dob: "2018-07-22"
 *             nationalId: "12345678"
 *             address: 123 Nairobi Street
 *             city: Nairobi
 *             country: Kenya
 *             occupation: Software Engineer
 *             employer: Tech Company Ltd
 *             salary: 120000
 *             contributionRate: 5.5
 *             retirementAge: 65
 *             accountType: MANDATORY
 *             riskProfile: MEDIUM
 *             currency: KES
 *             accountStatus: ACTIVE
 *             kycVerified: false
 *             complianceStatus: PENDING
 *             pin: "1234"
 *     responses:
 *       200:
 *         description: Payment initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: Request success status
 *                 status:
 *                   type: string
 *                   description: Payment initiation status
 *                 message:
 *                   type: string
 *                   description: Status message
 *                 transactionId:
 *                   type: string
 *                   description: Unique transaction identifier
 *                 checkoutRequestId:
 *                   type: string
 *                   description: M-Pesa checkout request ID
 *                 statusCheckUrl:
 *                   type: string
 *                   description: URL to check payment status
 *                 user:
 *                   type: object
 *                   description: Created user details
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                 account:
 *                   type: object
 *                   description: Created account details
 *                   properties:
 *                     id:
 *                       type: string
 *                     accountNumber:
 *                       type: string
 *                     accountType:
 *                       type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *                 issues:
 *                   type: array
 *                   items:
 *                     type: string
 *       409:
 *         description: Email or phone number already registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 *                 field:
 *                   type: string
 *                   description: Field that caused the conflict (email or phone)
 *       503:
 *         description: Payment gateway unavailable
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      const issues = validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        issues,
      });
    }

    const { email, phone, firstName, pin, accountType, riskProfile, currency, accountStatus, kycVerified, complianceStatus } = validation.data;

    // Check if user already exists
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) return res.status(409).json({ success: false, error: 'Email already registered', field: 'email' });
    const existingByPhone = (await prisma.user.findMany({ where: { phone } }))?.[0];
    if (existingByPhone) return res.status(409).json({ success: false, error: 'Phone number already registered', field: 'phone' });

    // Initiate M-Pesa STK Push payment
    const paymentGatewayBase = process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_URL || 'http://localhost:3001';
    const healthy = await waitForPaymentGatewayHealth(paymentGatewayBase, 60_000, 1000);
    if (!healthy) {
      console.error('[Register] Payment gateway health check failed');
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
      const providerCheckoutId = mpesaResponse.data.data.CheckoutRequestID;
      const checkoutId = providerCheckoutId ?? `CRID-${randomUUID()}`;

      const tempPassword = Math.random().toString(36).slice(2, 10);
      const hashedTempPassword = await hashPassword(tempPassword);

      let hashedPin: string | null = null;
      if (pin) {
        try {
          hashedPin = await hashPassword(pin);
        } catch (e) {
          console.error('[Register] Failed hashing PIN:', e);
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
            ...validation.data,
          },
        },
      });

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
    return res.status(500).json({ success: false, error: 'Failed to initiate payment. Please try again.' });
  }
});

/**
 * @swagger
 * /api/auth/register/status/{transactionId}:
 *   get:
 *     tags:
 *       - Authentication
 *     summary: Check registration payment status
 *     description: Poll this endpoint to check if payment was completed
 */
router.get('/register/status/:transactionId', async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Payment completed
    if (transaction.status === 'completed') {
      const metadata = (transaction.metadata ?? {}) as any;
      const { email, hashedTemporaryPassword, temporaryPasswordPlain, hashedPin } = metadata;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(500).json({ success: false, error: 'User not found after payment' });
      }

      // Link transaction to user
      await prisma.transaction.update({ where: { id: transactionId }, data: { userId: user.id } });

      // Auto-create default pension account
      let createdAccount: any = null;
      try {
        const accountRepo = AppDataSource.getRepository(Account);
        const acctType = metadata.accountType || 'MANDATORY';
        const existing = await accountRepo.findOne({ where: { userId: user.id, accountType: acctType } });
        if (existing) {
          createdAccount = existing;
          if (!createdAccount.accountNumber) {
            createdAccount.accountNumber = String(createdAccount.id).padStart(8, '0');
            await accountRepo.save(createdAccount);
          }
        } else {
          const account = accountRepo.create({
            userId: user.id,
            accountType: acctType,
            accountStatus: metadata.accountStatus || 'ACTIVE',
            riskProfile: metadata.riskProfile || 'MEDIUM',
            currency: metadata.currency || 'KES',
            openedAt: new Date(),
            currentBalance: 0,
            availableBalance: 0,
            lockedBalance: 0,
            kycVerified: metadata.kycVerified || false,
            complianceStatus: metadata.complianceStatus || 'PENDING',
          });
          createdAccount = await accountRepo.save(account);
          if (!createdAccount.accountNumber) {
            const padded = String(createdAccount.id).padStart(8, '0');
            createdAccount.accountNumber = padded;
            await accountRepo.save(createdAccount);
          }
        }
      } catch (accountError) {
        console.error('[Register] Failed to auto-create account:', accountError);
      }

      // Send notifications
      await sendWelcomeNotifications(email, metadata.phone, metadata.firstName || 'User', temporaryPasswordPlain, createdAccount?.accountNumber);

      // Generate token
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

    // Payment pending
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
