import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';
import { purchaseSchema } from '../schemas';
import axios from 'axios';

/**
 * @swagger
 * /api/payment/initiate:
 *   post:
 *     tags:
 *       - Payments
 *     summary: Initiate an M-Pesa STK Push payment
 *     description: Creates a pending payment transaction and initiates M-Pesa payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - phone
 *             properties:
 *               amount:
 *                 type: number
 *                 format: double
 *                 minimum: 0.01
 *                 example: 500
 *               phone:
 *                 type: string
 *                 example: "+254712345678"
 *               description:
 *                 type: string
 *                 example: "Monthly pension contribution"
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
 *                 message:
 *                   type: string
 *                 CheckoutRequestID:
 *                   type: string
 *                 transaction:
 *                   type: object
 *       400:
 *         description: Invalid input or missing configuration
 *       401:
 *         description: Not authenticated or invalid token
 *       500:
 *         description: Internal server error
 */
export const initiatePayment = async (req: Request, res: Response) => {
  try {
    const { phone, amount, description, referenceId, accountReference } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ success: false, error: 'Phone and amount are required' });
    }

    // Create a pending transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user?.userId || null,
        amount: Number(amount),
        type: 'payment',
        status: 'pending',
        description: description || 'Payment',
        metadata: {
          phone,
          referenceId: referenceId || null,
          accountReference: accountReference || null,
        },
      },
    });

    // Call M-Pesa service to initiate STK Push
    // This is a placeholder - you'll need to implement the actual M-Pesa service
    try {
      const mpesaToken = await getMpesaToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(
        `${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`
      ).toString('base64');

      const mpesaResponse = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        {
          BusinessShortCode: process.env.MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phone,
          PartyB: process.env.MPESA_SHORTCODE,
          PhoneNumber: phone,
          CallBackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payment/callback`,
          AccountReference: accountReference || `TXN-${transaction.id}`,
          TransactionDesc: description || 'Payment',
        },
        {
          headers: {
            Authorization: `Bearer ${mpesaToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (mpesaResponse.data?.CheckoutRequestID) {
        // Store M-Pesa response in transaction metadata
        const metadata = (transaction.metadata ?? {}) as any;
        metadata.checkoutRequestId = mpesaResponse.data.CheckoutRequestID;
        metadata.merchantRequestId = mpesaResponse.data.MerchantRequestID;

        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { metadata },
        });

        return res.json({
          success: true,
          message: 'Payment initiated',
          CheckoutRequestID: mpesaResponse.data.CheckoutRequestID,
          transaction: { id: transaction.id, amount, status: 'pending' },
        });
      }
    } catch (mpesaError) {
      console.error('M-Pesa initiation error:', mpesaError);
      return res.status(500).json({
        success: false,
        error: 'Failed to initiate M-Pesa payment',
      });
    }
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate payment' });
  }
};

// Helper function to get M-Pesa OAuth token
async function getMpesaToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get M-Pesa token:', error);
    throw error;
  }
}
