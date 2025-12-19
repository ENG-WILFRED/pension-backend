import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

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
    // Query directly by the checkoutRequestId column for fast, reliable lookup
    let transaction = await prisma.transaction.findUnique({
      where: {
        checkoutRequestId: CheckoutRequestID,
      },
    });

    if (!transaction) {
      console.warn(`Transaction not found for CheckoutRequestID: ${CheckoutRequestID}`);
      return res.status(200).json({
        ResultCode: 1,
        ResultDesc: 'Transaction not found',
      });
    }

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
