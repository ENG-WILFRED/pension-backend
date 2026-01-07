import { Router, Response } from 'express';
import { z } from 'zod';
import AppDataSource from '../../lib/data-source';
import { BankDetails } from '../../entities/BankDetails';
import { Account } from '../../entities/Account';
import requireAuth, { AuthRequest } from '../../middleware/auth';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * /api/accounts/{accountId}/bank-details:
 *   get:
 *     tags:
 *       - Bank Details
 *     summary: Get bank details for an account
 *     description: Returns bank details for a specific account. User can only access their own accounts, admins can access any.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: accountId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Bank details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bankDetails:
 *                   type: object
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Bank details not found
 */
router.get('/:accountId/bank-details', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const callerId = (req.user as any).userId;
    const caller = await prisma.user.findUnique({ where: { id: callerId } });
    
    if (!caller) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Verify user owns the account or is admin
    const accountRepo = AppDataSource.getRepository(Account);
    const account = await accountRepo.findOne({ where: { id: parseInt(accountId) } as any });
    
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    if (caller.role !== 'admin' && account.userId !== callerId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const bankDetailsRepo = AppDataSource.getRepository(BankDetails);
    const bankDetails = await bankDetailsRepo.findOne({ 
      where: { accountId: parseInt(accountId) } as any 
    });

    if (!bankDetails) return res.status(404).json({ success: false, error: 'Bank details not found' });
    return res.json({ success: true, bankDetails });
  } catch (error) {
    console.error('Get bank details error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const bankDetailsSchema = z.object({
  bankAccountName: z.string().min(1).optional(),
  bankAccountNumber: z.string().min(1).optional(),
  bankBranchName: z.string().min(1).optional(),
  bankBranchCode: z.string().min(1).optional(),
});

/**
 * @swagger
 * /api/accounts/{accountId}/bank-details:
 *   post:
 *     tags:
 *       - Bank Details
 *     summary: Create or update bank details for an account
 *     description: Create or update bank details for a specific account. User can only update their own accounts, admins can update any.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: accountId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankAccountName:
 *                 type: string
 *               bankAccountNumber:
 *                 type: string
 *               bankBranchName:
 *                 type: string
 *               bankBranchCode:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Bank details created or updated
 *       '400':
 *         description: Invalid input
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Account not found
 */
router.post('/:accountId/bank-details', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const callerId = (req.user as any).userId;
    const caller = await prisma.user.findUnique({ where: { id: callerId } });
    
    if (!caller) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Validate input
    const validation = bankDetailsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error });
    }

    // Verify user owns the account or is admin
    const accountRepo = AppDataSource.getRepository(Account);
    const account = await accountRepo.findOne({ where: { id: parseInt(accountId) } as any });
    
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    if (caller.role !== 'admin' && account.userId !== callerId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const bankDetailsRepo = AppDataSource.getRepository(BankDetails);
    let bankDetails = await bankDetailsRepo.findOne({ 
      where: { accountId: parseInt(accountId) } as any 
    });

    const updateData = validation.data;

    if (bankDetails) {
      // Update existing bank details
      await bankDetailsRepo.update(bankDetails.id, updateData);
      bankDetails = await bankDetailsRepo.findOneBy({ id: bankDetails.id } as any);
    } else {
      // Create new bank details
      const newBankDetails = bankDetailsRepo.create({
        accountId: parseInt(accountId),
        ...updateData,
      });
      bankDetails = await bankDetailsRepo.save(newBankDetails);
    }

    return res.json({ success: true, bankDetails });
  } catch (error) {
    console.error('Create/update bank details error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/accounts/{accountId}/bank-details:
 *   put:
 *     tags:
 *       - Bank Details
 *     summary: Update bank details for an account
 *     description: Update bank details for a specific account. User can only update their own accounts, admins can update any.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: accountId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankAccountName:
 *                 type: string
 *               bankAccountNumber:
 *                 type: string
 *               bankBranchName:
 *                 type: string
 *               bankBranchCode:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Bank details updated
 *       '400':
 *         description: Invalid input
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Bank details not found
 */
router.put('/:accountId/bank-details', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const callerId = (req.user as any).userId;
    const caller = await prisma.user.findUnique({ where: { id: callerId } });
    
    if (!caller) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Validate input
    const validation = bankDetailsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: validation.error });
    }

    // Verify user owns the account or is admin
    const accountRepo = AppDataSource.getRepository(Account);
    const account = await accountRepo.findOne({ where: { id: parseInt(accountId) } as any });
    
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    if (caller.role !== 'admin' && account.userId !== callerId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const bankDetailsRepo = AppDataSource.getRepository(BankDetails);
    const bankDetails = await bankDetailsRepo.findOne({ 
      where: { accountId: parseInt(accountId) } as any 
    });

    if (!bankDetails) return res.status(404).json({ success: false, error: 'Bank details not found' });

    const updateData = validation.data;
    await bankDetailsRepo.update(bankDetails.id, updateData);
    const updated = await bankDetailsRepo.findOneBy({ id: bankDetails.id } as any);

    return res.json({ success: true, bankDetails: updated });
  } catch (error) {
    console.error('Update bank details error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/accounts/{accountId}/bank-details:
 *   delete:
 *     tags:
 *       - Bank Details
 *     summary: Delete bank details for an account
 *     description: Delete bank details for a specific account. User can only delete their own accounts' bank details, admins can delete any.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: accountId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Bank details deleted
 *       '403':
 *         description: Forbidden
 *       '404':
 *         description: Bank details not found
 */
router.delete('/:accountId/bank-details', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const callerId = (req.user as any).userId;
    const caller = await prisma.user.findUnique({ where: { id: callerId } });
    
    if (!caller) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Verify user owns the account or is admin
    const accountRepo = AppDataSource.getRepository(Account);
    const account = await accountRepo.findOne({ where: { id: parseInt(accountId) } as any });
    
    if (!account) return res.status(404).json({ success: false, error: 'Account not found' });
    if (caller.role !== 'admin' && account.userId !== callerId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const bankDetailsRepo = AppDataSource.getRepository(BankDetails);
    const bankDetails = await bankDetailsRepo.findOne({ 
      where: { accountId: parseInt(accountId) } as any 
    });

    if (!bankDetails) return res.status(404).json({ success: false, error: 'Bank details not found' });

    await bankDetailsRepo.remove(bankDetails);
    return res.json({ success: true, message: 'Bank details deleted' });
  } catch (error) {
    console.error('Delete bank details error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
