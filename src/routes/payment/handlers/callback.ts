import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';
import AppDataSource from '../../../lib/data-source';
import { Account } from '../../../entities/Account';
import { BankDetails } from '../../../entities/BankDetails';

/**
 * @swagger
 * /api/payment/callback:
 *   post:
 *     tags:
 *       - Payments
 *     summary: M-Pesa STK Push callback webhook
 *     description: Webhook endpoint for M-Pesa to deliver payment results (ResultCode=0 is success)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Body:
 *                 type: object
 *                 properties:
 *                   stkCallback:
 *                     type: object
 *                     properties:
 *                       MerchantRequestID:
 *                         type: string
 *                       CheckoutRequestID:
 *                         type: string
 *                       ResultCode:
 *                         type: integer
 *                         example: 0
 *                       ResultDesc:
 *                         type: string
 *                       CallbackMetadata:
 *                         type: object
 *     responses:
 *       200:
 *         description: Callback processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ResultCode:
 *                   type: integer
 *                   example: 0
 *                 ResultDesc:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal server error
 */
export const handlePaymentCallback = async (req: Request, res: Response) => {
  try {
    // M-Pesa wraps the callback in Body.stkCallback
    const callbackData = req.body?.Body?.stkCallback;

    if (!callbackData) {
      console.warn('Invalid callback format:', req.body);
      return res.status(200).json({
        ResultCode: 1,
        ResultDesc: 'Invalid callback format',
      });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, MerchantRequestID, CallbackMetadata } = callbackData;

    console.log(`[M-Pesa Callback] CheckoutRequestID: ${CheckoutRequestID}, ResultCode: ${ResultCode}`);

    if (!CheckoutRequestID) {
      return res.status(200).json({
        ResultCode: 1,
        ResultDesc: 'Missing CheckoutRequestID',
      });
    }

    // Find transaction by CheckoutRequestID
    console.log(`[M-Pesa Callback] Searching for transaction with checkoutRequestId: ${CheckoutRequestID}`);

    // Try direct column lookup first (fast path)
    let transaction = await prisma.transaction.findUnique({
      where: {
        checkoutRequestId: CheckoutRequestID,
      },
    });

    // Fallback: some flows store the provider's CheckoutRequestID inside metadata
    // If the direct lookup failed, search recent pending transactions and match metadata in JS
    if (!transaction) {
      console.warn(`[M-Pesa] Transaction not found by column for CheckoutRequestID: ${CheckoutRequestID}. Falling back to metadata search.`);

      // Search recent transactions regardless of status to increase chance of matching
      const candidates = await prisma.transaction.findMany({
        take: 500,
        orderBy: { createdAt: 'desc' },
      });

      transaction = candidates.find((t) => {
        try {
          const md = (t.metadata ?? {}) as any;
          // check common metadata keys that may contain the CheckoutRequestID
          return (
            md?.checkoutRequestId === CheckoutRequestID ||
            md?.mpesaCheckoutRequestID === CheckoutRequestID ||
            md?.CheckoutRequestID === CheckoutRequestID ||
            md?.checkoutRequestID === CheckoutRequestID
          );
        } catch (_e) {
          return false;
        }
      }) as any;

      if (transaction) {
        console.log(`[M-Pesa] Found transaction by metadata fallback: ${transaction.id}`);
      } else {
        console.warn(`[M-Pesa] No transaction matched by metadata for CheckoutRequestID: ${CheckoutRequestID}. Trying JSON query fallback.`);

        // Final fallback: run a DB JSON query (Postgres) to match metadata->>'checkoutRequestId'
        try {
          const rows: any = await AppDataSource.query(
            `SELECT * FROM transactions WHERE metadata->>'checkoutRequestId' = $1 LIMIT 1`,
            [CheckoutRequestID]
          );
          if (Array.isArray(rows) && rows.length > 0) {
            transaction = rows[0] as any;
            console.log(`[M-Pesa] Found transaction via JSON query fallback: ${transaction.id}`);
          }
        } catch (jsonQueryError) {
          console.warn('[M-Pesa] JSON query fallback failed:', jsonQueryError?.message || jsonQueryError);
        }

        if (!transaction) {
          return res.status(200).json({
            ResultCode: 1,
            ResultDesc: 'Transaction not found',
          });
        }
      }
    }
    
    console.log(`[M-Pesa Callback] Transaction found: ${transaction.id}`);

    // Determine status based on ResultCode
    // ResultCode: 0 = Success, non-zero = Failed
    const status = ResultCode === 0 ? 'completed' : 'failed';

    // Extract payment details from CallbackMetadata if successful
    const metadata = (transaction.metadata ?? {}) as any;
    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const items = CallbackMetadata.Item;
      const mpesaDetails: any = {};

      items.forEach((item: any) => {
        mpesaDetails[item.Name] = item.Value;
      });

      // Store M-Pesa receipt, balance, transaction date, etc.
      metadata.mpesaReceipt = mpesaDetails.MpesaReceiptNumber;
      metadata.mpesaTransactionDate = mpesaDetails.TransactionDate;
      metadata.mpesaBalance = mpesaDetails.Balance;
      metadata.mpesaPhoneNumber = mpesaDetails.PhoneNumber;
    }

    // Always include the callback response in metadata
    metadata.mpesaResultCode = ResultCode;
    metadata.mpesaResultDesc = ResultDesc;
    metadata.mpesaMerchantRequestID = MerchantRequestID;
    metadata.mpesaCheckoutRequestID = CheckoutRequestID;

    // Update transaction status and metadata
    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status,
        metadata,
      },
    });

    console.log(
      `[M-Pesa Callback] Transaction ${transaction.id} updated to status: ${status}`,
    );

    // If this payment was for an account deposit/contribution, credit the account balances
    try {
      if (status === 'completed' && (updated.type === 'payment' || updated.type === 'contribution' || updated.type === 'deposit')) {
        const accountId = (updated as any).accountId as number | undefined;
        if (accountId) {
          try {
            const accountRepo = AppDataSource.getRepository(Account);
            // Use repository to respect entity naming
            const account: any = await accountRepo.findOne({ where: { id: accountId } });
            if (account) {
              const amt = Number(updated.amount || 0);
              account.currentBalance = Number(account.currentBalance || 0) + amt;
              account.availableBalance = Number(account.availableBalance || 0) + amt;
              account.lastContributionAt = new Date();
              account.lastTransactionId = updated.id;
              await accountRepo.save(account);
              console.log(`[M-Pesa Callback] Credited account ${accountId} with amount ${amt}`);
            } else {
              console.warn(`[M-Pesa Callback] Account ${accountId} not found to credit`);
            }
          } catch (acctErr) {
            console.error('[M-Pesa Callback] Failed updating account balances:', acctErr);
          }
        }
      }
    } catch (acctFlowErr) {
      console.error('[M-Pesa Callback] Account credit flow error:', acctFlowErr);
    }

    // If this was a registration transaction and succeeded, create the user from metadata
    try {
      if (status === 'completed' && (updated.type === 'registration' || transaction.type === 'registration')) {
        const meta = (updated.metadata ?? {}) as any;
        const email = meta.email as string | undefined;
        const hashedTemporaryPassword = meta.hashedTemporaryPassword as string | undefined;
        const temporaryPasswordPlain = meta.temporaryPasswordPlain as string | undefined;

        if (email && hashedTemporaryPassword) {
          // Build user payload from metadata
          const children = Array.isArray(meta.children) ? meta.children : undefined;
          const numberOfChildren = Array.isArray(children) ? children.length : null;

          const userData: any = {
            email,
            password: hashedTemporaryPassword,
            passwordIsTemporary: true,
            firstName: meta.firstName || null,
            lastName: meta.lastName || null,
            phone: meta.phone || null,
            dateOfBirth: meta.dateOfBirth || null,
            gender: meta.gender || null,
            maritalStatus: meta.maritalStatus || null,
            spouseName: meta.spouseName || null,
            spouseDob: meta.spouseDob || null,
            children: children || null,
            numberOfChildren: numberOfChildren,
            nationalId: meta.nationalId || null,
            address: meta.address || null,
            city: meta.city || null,
            country: meta.country || null,
            occupation: meta.occupation || null,
            employer: meta.employer || null,
            salary: typeof meta.salary === 'string' ? Number(meta.salary) : meta.salary ?? null,
            contributionRate: typeof meta.contributionRate === 'string' ? Number(meta.contributionRate) : meta.contributionRate ?? null,
            retirementAge: typeof meta.retirementAge === 'string' ? Number(meta.retirementAge) : meta.retirementAge ?? null,
            role: 'customer',
            ...(meta.hashedPin ? { pin: meta.hashedPin } : {}),
          };

          // Idempotent create-or-update: if user exists update, otherwise create
          let user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            user = await prisma.user.create({ data: userData });
            console.log(`[M-Pesa Callback] Created user ${user.id} for registration transaction ${transaction.id}`);
          } else {
            await prisma.user.update({ where: { email }, data: userData });
            console.log(`[M-Pesa Callback] Updated existing user ${user.id} with registration metadata`);
            user = await prisma.user.findUnique({ where: { email } });
          }

          // Ensure transaction links to the user
          if (user && !updated.userId) {
            await prisma.transaction.update({ where: { id: transaction.id }, data: { userId: user.id } });
            console.log(`[M-Pesa Callback] Linked transaction ${transaction.id} to user ${user.id}`);
          }

          // Auto-create default pension account for new user (avoid duplicates)
          let createdAccount: any = null;
          try {
            const accountRepo = AppDataSource.getRepository(Account);
            const acctType = meta.accountType || 'MANDATORY';
            const existing = await accountRepo.findOne({ where: { userId: user.id, accountType: acctType } });
            if (existing) {
              createdAccount = existing;
              if (!createdAccount.accountNumber) {
                createdAccount.accountNumber = String(createdAccount.id).padStart(8, '0');
                await accountRepo.save(createdAccount);
              }
              console.log(`[M-Pesa Callback] Re-used existing pension account ${createdAccount.id} for user ${user.id}`);
            } else {
              const account = accountRepo.create({
                userId: user.id,
                accountType: acctType,
                accountStatus: meta.accountStatus || 'ACTIVE',
                riskProfile: meta.riskProfile || 'MEDIUM',
                currency: meta.currency || 'KES',
                openedAt: new Date(),
                currentBalance: 0,
                availableBalance: 0,
                lockedBalance: 0,
                kycVerified: meta.kycVerified || false,
                complianceStatus: meta.complianceStatus || 'PENDING',
                // bank details (optional)
                bankAccountName: meta.bankAccountName ?? null,
                bankAccountNumber: meta.bankAccountNumber ?? null,
                bankBranchName: meta.bankBranchName ?? null,
                bankBranchCode: meta.bankBranchCode ?? null,
              });
              // Save to obtain numeric auto-increment id
              createdAccount = await accountRepo.save(account);
              // If no accountNumber was provided, set accountNumber as zero-padded 8-digit string from id
              if (!createdAccount.accountNumber) {
                const padded = String(createdAccount.id).padStart(8, '0');
                createdAccount.accountNumber = padded;
                await accountRepo.save(createdAccount);
              }
              console.log(`[M-Pesa Callback] Auto-created default pension account ${createdAccount.id} for user ${user.id}`);
            }
          } catch (accountError) {
            console.error('[M-Pesa Callback] Failed to auto-create account:', accountError);
            // Don't fail the callback if account creation fails
          }

          // Send temporary password to user via both email and SMS
          try {
            const { notify } = await import('../../../lib/notification');
            if (temporaryPasswordPlain && user) {
              // Send email with temporary password
              try {
                await notify({
                  to: email,
                  channel: 'email',
                  template: 'welcome',
                  data: {
                    name: meta.firstName || 'User',
                    temp_password: temporaryPasswordPlain,
                    link: process.env.FRONTEND_URL || 'https://transactions-k6gk.onrender.com/login'
                  },
                });
                console.log(`[M-Pesa Callback] Sent welcome email to ${email}`);
              } catch (emailError) {
                console.error(`[M-Pesa Callback] Failed sending email notification: ${emailError}`);
              }

              // Send SMS with temporary password
              try {
                await notify({
                  to: meta.phone,
                  channel: 'sms',
                  template: 'welcome',
                  data: {
                    name: meta.firstName || 'User',
                    temp_password: temporaryPasswordPlain,
                    link: process.env.FRONTEND_URL || 'https://transactions-k6gk.onrender.com/login'
                  },
                });
                console.log(`[M-Pesa Callback] Sent welcome SMS to ${meta.phone}`);
              } catch (smsError) {
                console.error(`[M-Pesa Callback] Failed sending SMS notification: ${smsError}`);
              }
            }
          } catch (notificationErr) {
            console.error('[M-Pesa Callback] Error sending notifications:', notificationErr);
          }
        } else {
          console.warn(`[M-Pesa Callback] Registration metadata missing email/hashedTemporaryPassword for transaction ${transaction.id}`);
        }
      }
    } catch (userErr) {
      console.error('[M-Pesa Callback] Error creating/linking user from registration metadata:', userErr);
    }

    // Return M-Pesa compliant response
    res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Callback received successfully',
      recordedId: transaction.id,
    });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(200).json({
      ResultCode: 1,
      ResultDesc: 'Internal server error',
    });
  }
};
