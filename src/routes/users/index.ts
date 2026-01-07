import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import AppDataSource from '../../lib/data-source';
import { BankDetails } from '../../entities/BankDetails';
import { User } from '../../entities/User';
import requireAuth, { AuthRequest } from '../../middleware/auth';

const router = Router();
const bankDetailsRepo = AppDataSource.getRepository(BankDetails);
const userRepo = AppDataSource.getRepository(User);

// GET /api/users/user-names-by-phone
router.get('/user-names-by-phone', async (req, res: Response) => {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { firstName, lastName, email } = user;
    res.json({ success: true, firstName, lastName, email });
  } catch (error) {
    console.error('Get user names error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/users/ - Get authenticated user
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const { id } = req.params;

    const requestedUser = await prisma.user.findUnique({ where: { id } });
    if (!requestedUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Only allow users to view themselves or admins to view anyone
    const caller = await prisma.user.findUnique({ where: { id: userId } });
    if (caller?.role !== 'admin' && userId !== id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    res.json({ success: true, user: requestedUser });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/users/:id/bank-details - Update bank details
router.put('/:id/bank-details', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const { id } = req.params;

    const caller = await prisma.user.findUnique({ where: { id: userId } });
    if (caller?.role !== 'admin' && userId !== id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { accountId, bankAccountName, bankBranchName, bankBranchCode, bankAccountNumber } = req.body;

    if (!accountId) {
      return res.status(400).json({ success: false, error: 'accountId is required' });
    }

    const existing = await bankDetailsRepo.findOne({ where: { accountId } });

    let bankDetails;
    if (existing) {
      Object.assign(existing, {
        bankAccountName: bankAccountName ?? existing.bankAccountName,
        bankBranchName: bankBranchName ?? existing.bankBranchName,
        bankBranchCode: bankBranchCode ?? existing.bankBranchCode,
        bankAccountNumber: bankAccountNumber ?? existing.bankAccountNumber,
      });
      bankDetails = await bankDetailsRepo.save(existing);
    } else {
      const newBankDetails = bankDetailsRepo.create({
        accountId,
        bankAccountName,
        bankBranchName,
        bankBranchCode,
        bankAccountNumber,
      });
      bankDetails = await bankDetailsRepo.save(newBankDetails);
    }

    res.json({ success: true, bankDetails });
  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/users/:id - Update user profile
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const { id } = req.params;

    const caller = await prisma.user.findUnique({ where: { id: userId } });
    if (caller?.role !== 'admin' && userId !== id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      gender,
      maritalStatus,
      spouseName,
      spouseDob,
      children,
      nationalId,
      address,
      city,
      country,
      occupation,
      employer,
      salary,
      contributionRate,
      retirementAge,
    } = req.body;

    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (gender !== undefined) updateData.gender = gender;
    if (maritalStatus !== undefined) updateData.maritalStatus = maritalStatus;
    if (spouseName !== undefined) updateData.spouseName = spouseName;
    if (spouseDob !== undefined) updateData.spouseDob = spouseDob;
    if (children !== undefined) {
      updateData.children = children;
      updateData.numberOfChildren = Array.isArray(children) ? children.length : 0;
    }
    if (nationalId !== undefined) updateData.nationalId = nationalId;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (country !== undefined) updateData.country = country;
    if (occupation !== undefined) updateData.occupation = occupation;
    if (employer !== undefined) updateData.employer = employer;
    if (salary !== undefined) updateData.salary = salary;
    if (contributionRate !== undefined) updateData.contributionRate = contributionRate;
    if (retirementAge !== undefined) updateData.retirementAge = retirementAge;

    const updatedUser = await prisma.user.update({ where: { id }, data: updateData });
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req.user as any).userId;
    const { id } = req.params;

    const caller = await prisma.user.findUnique({ where: { id: userId } });
    if (caller?.role !== 'admin' && userId !== id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
