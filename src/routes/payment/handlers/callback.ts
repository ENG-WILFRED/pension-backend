import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';
import AppDataSource from '../../../lib/data-source';
import { Account } from '../../../entities/Account';
import { createOrUpdateUserFromMetadata, createOrReuseAccount } from './services/registration';

export const handlePaymentCallback = async (req: Request, res: Response) => {
  try {
    const callbackData = req.body?.Body?.stkCallback;

    if (!callbackData) {
      console.warn('Invalid callback format:', req.body);
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Invalid callback format' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, MerchantRequestID, CallbackMetadata } = callbackData;

    console.log(`[M-Pesa Callback] CheckoutRequestID: ${CheckoutRequestID}, ResultCode: ${ResultCode}`);

    if (!CheckoutRequestID) {
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Missing CheckoutRequestID' });
    }

    let transaction = await prisma.transaction.findUnique({ where: { checkoutRequestId: CheckoutRequestID } });

    if (!transaction) {
      console.warn(`[M-Pesa] Transaction not found by column, trying metadata fallback...`);
      const candidates = await prisma.transaction.findMany({ take: 500, orderBy: { createdAt: 'desc' } });
      transaction = candidates.find((t) => {
        const md = (t.metadata ?? {}) as any;
        return md?.checkoutRequestId === CheckoutRequestID || md?.mpesaCheckoutRequestID === CheckoutRequestID || md?.CheckoutRequestID === CheckoutRequestID;
      }) as any;

      if (!transaction) {
        try {
          const rows: any = await AppDataSource.query(
            `SELECT * FROM transactions WHERE metadata->>'checkoutRequestId' = $1 LIMIT 1`,
            [CheckoutRequestID]
          );
          if (Array.isArray(rows) && rows.length > 0) {
            transaction = rows[0];
            console.log(`[M-Pesa] Found transaction via JSON query: ${transaction.id}`);
          }
        } catch (jsonQueryError) {
          console.warn('[M-Pesa] JSON query fallback failed');
        }

        if (!transaction) {
          return res.status(200).json({ ResultCode: 1, ResultDesc: 'Transaction not found' });
        }
      }
    }

    const status = ResultCode === 0 ? 'completed' : 'failed';
    const metadata = (transaction.metadata ?? {}) as any;

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      const items = CallbackMetadata.Item;
      const mpesaDetails: any = {};
      items.forEach((item: any) => {
        mpesaDetails[item.Name] = item.Value;
      });
      metadata.mpesaReceipt = mpesaDetails.MpesaReceiptNumber;
      metadata.mpesaTransactionDate = mpesaDetails.TransactionDate;
      metadata.mpesaBalance = mpesaDetails.Balance;
      metadata.mpesaPhoneNumber = mpesaDetails.PhoneNumber;
    }

    metadata.mpesaResultCode = ResultCode;
    metadata.mpesaResultDesc = ResultDesc;
    metadata.mpesaMerchantRequestID = MerchantRequestID;
    metadata.mpesaCheckoutRequestID = CheckoutRequestID;

    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status, metadata },
    });

    console.log(`[M-Pesa Callback] Transaction ${transaction.id} updated to status: ${status}`);

    // Credit account if deposit/contribution
    if (status === 'completed' && (updated.type === 'payment' || updated.type === 'contribution' || updated.type === 'deposit')) {
      const accountId = (updated as any).accountId as number | undefined;
      if (accountId) {
        try {
          const accountRepo = AppDataSource.getRepository(Account);
          const account: any = await accountRepo.findOne({ where: { id: accountId } });
          if (account) {
            const amt = Number(updated.amount || 0);
            account.currentBalance = Number(account.currentBalance || 0) + amt;
            account.availableBalance = Number(account.availableBalance || 0) + amt;
            account.lastContributionAt = new Date();
            account.lastTransactionId = updated.id;
            await accountRepo.save(account);
            console.log(`[M-Pesa Callback] Credited account ${accountId} with amount ${amt}`);
          }
        } catch (acctErr) {
          console.error('[M-Pesa Callback] Failed updating account:', acctErr);
        }
      }
    }

    // Handle registration transaction completion
    if (status === 'completed' && (updated.type === 'registration' || transaction.type === 'registration')) {
      try {
        const meta = (updated.metadata ?? {}) as any;
        const user = await createOrUpdateUserFromMetadata(meta);

        if (user && !updated.userId) {
          await prisma.transaction.update({ where: { id: transaction.id }, data: { userId: user.id } });
          console.log(`[M-Pesa Callback] Linked transaction ${transaction.id} to user ${user.id}`);
        }

        let createdAccount: any = null;
        try {
          createdAccount = await createOrReuseAccount(user.id, meta);
        } catch (accountError) {
          console.error('[M-Pesa Callback] Failed to auto-create account:', accountError);
        }
      } catch (userErr) {
        console.error('[M-Pesa Callback] Error processing registration:', userErr);
      }
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Callback received successfully', recordedId: transaction.id });
  } catch (error) {
    console.error('Callback error:', error);
    res.status(200).json({ ResultCode: 1, ResultDesc: 'Internal server error' });
  }
};
