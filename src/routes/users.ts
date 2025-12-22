import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import requireAuth, { AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: List users (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of users
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const caller = await prisma.user.findUnique({ where: { id: (req.user as any).userId } });
    if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Admins only' });
    const users = await prisma.user.findMany();
    return res.json({ success: true, users });
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Get a user by id (self or admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User object
 */
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const callerId = (req.user as any).userId;
    const caller = await prisma.user.findUnique({ where: { id: callerId } });
    if (!caller) return res.status(401).json({ success: false, error: 'Unauthorized' });

    if ( callerId !== id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

const updateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  spouseName: z.string().optional(),
  spouseDob: z.string().optional(),
  children: z.array(z.object({ name: z.string().optional(), dob: z.string().optional() })).optional(),
  numberOfChildren: z.number().optional(),
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

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags:
 *       - Dashboard
 *     summary: Update a user (self or admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *     responses:
 *       '200':
 *         description: Updated user
 */
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ success: false, error: validation.error.issues[0].message });

    const callerId = (req.user as any).userId;
    const caller = await prisma.user.findUnique({ where: { id: callerId } });
    if (!caller) return res.status(401).json({ success: false, error: 'Unauthorized' });

    if (caller.role !== 'admin' && callerId !== id) return res.status(403).json({ success: false, error: 'Forbidden' });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const updated = await prisma.user.update({ where: { id }, data: validation.data });
    return res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags:
 *       - Dashboard
 *     summary: Delete a user (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Deleted user
 */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const caller = await prisma.user.findUnique({ where: { id: (req.user as any).userId } });
    if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Admins only' });

    const deleted = await prisma.user.delete({ where: { id } });
    if (!deleted) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({ success: true, user: deleted });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
