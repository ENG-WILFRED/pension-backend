import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../../lib/prisma';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();

const promoteSchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
}).refine((data) => !!data.email || !!data.userId, {
  message: 'Either email or userId is required',
});

const promoteCreateSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

/**
 * @swagger
 * /api/auth/makeadmin:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Create or promote an admin
 *     description: |
 *       Create a new admin user (by an existing admin) or promote an existing customer to admin.
 *       Creating a new admin requires `email` and `phone`. Promoting an existing user accepts
 *       either `email` or `userId`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - required: [email, phone]
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *                   phone:
 *                     type: string
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   dateOfBirth:
 *                     type: string
 *                     format: date
 *                   gender:
 *                     type: string
 *                   address:
 *                     type: string
 *                   city:
 *                     type: string
 *                   country:
 *                     type: string
 *               - required: [email]
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *               - required: [userId]
 *                 properties:
 *                   userId:
 *                     type: string
 *                     format: uuid
 *     responses:
 *       '200':
 *         description: User promoted or created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       '400':
 *         description: Bad request (validation error or target not a customer)
 *       '401':
 *         description: Unauthorized (missing or invalid token)
 *       '403':
 *         description: Forbidden (caller is not an admin)
 *       '404':
 *         description: Target user not found
 */
router.post('/makeadmin', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    // Allow two flows:
    // 1) promote existing user by email or userId (use promoteSchema)
    // 2) create new admin user with provided details (use promoteCreateSchema)

    const payload = req.user as any;
    // Ensure caller is an admin
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can promote users' });
    }

    // If body matches create schema, create new admin user
    const createValidation = promoteCreateSchema.safeParse(req.body);
    if (createValidation.success) {
      const data = createValidation.data;
      // Check if user already exists
      let user = await prisma.user.findUnique({ where: { email: data.email } });
      if (user) {
        // If exists, update role to admin and update details
        await prisma.user.update({ where: { id: user.id }, data: { role: 'admin', phone: data.phone, firstName: data.firstName, lastName: data.lastName, dateOfBirth: data.dateOfBirth || null, gender: data.gender || null, address: data.address || null, city: data.city || null, country: data.country || null} });
        // Send notification that they've been promoted and possibly password reset not required
        return res.json({ success: true, message: 'Existing user promoted to admin' });
      }

      // Create temporary password and create user
      const tempPassword = Math.random().toString(36).slice(2, 10);
      const hashed = await (await import('../../lib/auth')).hashPassword(tempPassword).catch((e) => { throw e; });

      user = await prisma.user.create({
        data: {
          email: data.email,
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth || null,
          gender: data.gender || null,
          address: data.address || null,
          city: data.city || null,
          country: data.country || null,
          password: hashed,
          passwordIsTemporary: true,
          role: 'admin',
        },
      });

      // Send temporary password via notification (email and/or sms)
      try {
        const { notify } = await import('../../lib/notification');
        await Promise.all([
          notify({ to: data.email, channel: 'email', template: 'welcome', data: { name: data.firstName || 'User', temporaryPassword: tempPassword } }).catch((e) => console.error('Email notify failed', e)),
          notify({ to: data.phone, channel: 'sms', template: 'welcome', data: { name: data.firstName || 'User', temp_password: tempPassword } }).catch((e) => console.error('SMS notify failed', e)),
        ]);
      } catch (e) {
        console.error('Failed sending notifications for new admin:', e);
      }

      return res.json({ success: true, message: 'Admin user created and temporary password sent' });
    }

    // Otherwise, attempt to promote existing user (by email or userId)
    const validation = promoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { email, userId } = validation.data;

    // Find target user
    const target = email
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findUnique({ where: { id: userId! } });

    if (!target) return res.status(404).json({ success: false, error: 'Target user not found' });

    // Must be customer to be promoted
    if (target.role !== 'customer') {
      return res.status(400).json({ success: false, error: 'Target must be a customer to be promoted' });
    }

    // Promote
    await prisma.user.update({ where: { id: target.id }, data: { role: 'admin' } });

    return res.json({ success: true, message: 'User promoted to admin' });
  } catch (error) {
    console.error('Promote error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;

/**
 * @swagger
 * /api/auth/demote:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Demote an admin to customer
 *     description: |
 *       Demote an existing user with role `admin` back to `customer`. Only callers with a valid
 *       admin Bearer token may perform this action. The target user must currently be an admin.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - required: [email]
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *               - required: [userId]
 *                 properties:
 *                   userId:
 *                     type: string
 *                     format: uuid
 *     responses:
 *       '200':
 *         description: User demoted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       '400':
 *         description: Bad request (validation error or target not an admin)
 *       '401':
 *         description: Unauthorized (missing or invalid token)
 *       '403':
 *         description: Forbidden (caller is not an admin)
 *       '404':
 *         description: Target user not found
 */
router.post('/demote', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = promoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: validation.error.issues[0].message });
    }

    const { email, userId } = validation.data;

    const payload = req.user as any;

    // Ensure caller is an admin
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!caller || caller.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Only admins can demote users' });
    }

    // Find target user
    const target = email
      ? await prisma.user.findUnique({ where: { email } })
      : await prisma.user.findUnique({ where: { id: userId! } });

    if (!target) return res.status(404).json({ success: false, error: 'Target user not found' });

    // Must be admin to be demoted
    if (target.role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Target must be an admin to be demoted' });
    }

    // Prevent self-demotion
    if (target.id === payload.userId) {
      return res.status(400).json({ success: false, error: 'Admins cannot demote themselves' });
    }

    // Demote
    await prisma.user.update({ where: { id: target.id }, data: { role: 'customer' } });

    return res.json({ success: true, message: 'User demoted to customer' });
  } catch (error) {
    console.error('Demote error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

