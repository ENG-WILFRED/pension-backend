import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

/**
 * @swagger
 * /api/payment/status/{transactionId}:
 *   get:
 *     tags:
 *       - Payments
 *     summary: Get transaction status
 *     description: Retrieves the current status of a payment transaction
 *     parameters:
 *       - name: transactionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID to check
 *     responses:
 *       200:
 *         description: Transaction found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     type:
 *                       type: string
 *                       enum: ["registration", "pension_contribution"]
 *                     status:
 *                       type: string
 *                       enum: ["pending", "completed", "failed"]
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Internal server error
 */
export const getTransactionStatus = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
  }
};
