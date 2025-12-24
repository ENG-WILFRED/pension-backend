import { Router, Response } from 'express';
import { z } from 'zod';
import dataSource from '../lib/data-source';
import requireAuth, { AuthRequest } from '../middleware/auth';
import { TermsAndConditions } from '../entities/TermsAndConditions';
import { User } from '../entities/User';

const router = Router();
const termsRepository = dataSource.getRepository(TermsAndConditions);

/**
 * @swagger
 * /api/terms-and-conditions:
 *   get:
 *     tags:
 *       - Terms and Conditions
 *     summary: Get current terms and conditions
 *     description: Retrieve the latest terms and conditions document
 *     responses:
 *       '200':
 *         description: Terms and conditions document
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 body:
 *                   type: string
 *                   description: HTML formatted terms and conditions
 *                 createdDate:
 *                   type: string
 *                   format: date-time
 *                 updatedDate:
 *                   type: string
 *                   format: date-time
 *       '404':
 *         description: No terms and conditions found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res: Response) => {
  try {
    // Get the latest (only) terms and conditions
    const termsAndConditions = await termsRepository.findOne({
      order: { updatedDate: 'DESC' },
    });

    if (!termsAndConditions) {
      return res.status(404).json({ error: 'Terms and conditions not found' });
    }

    res.status(200).json(termsAndConditions);
  } catch (error) {
    console.error('Get terms and conditions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/terms-and-conditions:
 *   put:
 *     tags:
 *       - Terms and Conditions
 *     summary: Update terms and conditions (admin only)
 *     description: Update the entire terms and conditions document with new HTML content. Admin users only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - body
 *             properties:
 *               body:
 *                 type: string
 *                 description: HTML formatted terms and conditions content
 *     responses:
 *       '200':
 *         description: Terms and conditions updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     body:
 *                       type: string
 *                     createdDate:
 *                       type: string
 *                       format: date-time
 *                     updatedDate:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '403':
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '401':
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       '500':
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Validate request body
    const updateSchema = z.object({
      body: z.string().min(1, 'Body is required'),
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: validation.error.errors 
      });
    }

    // Check if user is admin
    const userId = (req.user as any).userId;
    const userRepository = dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get existing or create new terms and conditions
    let termsAndConditions = await termsRepository.findOne({
      order: { updatedDate: 'DESC' },
    });

    if (termsAndConditions) {
      // Update existing
      termsAndConditions.body = validation.data.body;
      await termsRepository.save(termsAndConditions);
    } else {
      // Create new
      termsAndConditions = termsRepository.create({
        body: validation.data.body,
      });
      await termsRepository.save(termsAndConditions);
    }

    res.status(200).json({
      success: true,
      message: 'Terms and conditions updated successfully',
      data: termsAndConditions,
    });
  } catch (error) {
    console.error('Update terms and conditions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
