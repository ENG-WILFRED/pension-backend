import prisma from '../../../lib/prisma';
import AppDataSource from '../../../lib/data-source';
import { Account } from '../../../entities/Account';
import { hashPassword } from '../../../lib/auth';
import { randomUUID } from 'crypto';
import { notify } from '../../../lib/notification';

interface CreateUserParams {
  email: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  spouseName?: string;
  spouseDob?: string;
  children?: any[];
  nationalId?: string;
  address?: string;
  city?: string;
  country?: string;
  occupation?: string;
  employer?: string;
  salary?: number;
  contributionRate?: number;
  retirementAge?: number;
  hashedPin?: string;
}

export async function createUserWithAccount(params: CreateUserParams, accountConfig: any) {
  const { email, phone, hashedPin, ...userData } = params;

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    throw new Error('User already exists');
  }

  const temporaryPassword = randomUUID().slice(0, 12);
  const hashedTemporaryPassword = await hashPassword(temporaryPassword);

  const numberOfChildren = Array.isArray(userData.children) ? userData.children.length : null;

  user = await prisma.user.create({
    data: {
      email,
      password: hashedTemporaryPassword,
      passwordIsTemporary: true,
      phone,
      numberOfChildren,
      role: 'customer',
      ...(hashedPin ? { pin: hashedPin } : {}),
      ...userData,
    },
  });

  // Auto-create default pension account for new user
  let createdAccount: any = null;
  const { accountType = 'MANDATORY', accountStatus = 'ACTIVE', riskProfile = 'MEDIUM', currency = 'KES', kycVerified = false, complianceStatus = 'PENDING' } = accountConfig;

  try {
    const accountRepo = AppDataSource.getRepository(Account);
    const existing = await accountRepo.findOne({ where: { userId: user.id, accountType } });
    if (existing) {
      createdAccount = existing;
      if (!createdAccount.accountNumber) {
        createdAccount.accountNumber = String(createdAccount.id).padStart(8, '0');
        await accountRepo.save(createdAccount);
      }
    } else {
      const account = accountRepo.create({
        userId: user.id,
        accountType,
        accountStatus,
        riskProfile,
        currency,
        openedAt: new Date(),
        currentBalance: 0,
        availableBalance: 0,
        lockedBalance: 0,
        kycVerified,
        complianceStatus,
      });
      createdAccount = await accountRepo.save(account);
      if (!createdAccount.accountNumber) {
        const padded = String(createdAccount.id).padStart(8, '0');
        createdAccount.accountNumber = padded;
        await accountRepo.save(createdAccount);
      }
    }
  } catch (err) {
    console.error('[Register] Failed to auto-create account:', err);
  }

  return { user, createdAccount, temporaryPassword };
}

export async function sendWelcomeNotifications(email: string, phone: string, firstName: string, tempPassword: string, accountNumber?: string) {
  try {
    const notificationData = {
      name: firstName || 'User',
      temp_password: tempPassword,
      link: 'https://transactions-k6gk.onrender.com/login',
      account_number: accountNumber || null,
    };

    await notify({
      to: email,
      channel: 'email',
      template: 'welcome',
      data: notificationData,
    });

    await notify({
      to: phone,
      channel: 'sms',
      template: 'welcome',
      data: notificationData,
    });

    console.log('[Register] Sent welcome notifications to', email, phone);
  } catch (err) {
    console.error('[Register] Failed sending notifications:', err);
  }
}
