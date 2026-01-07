import prisma from '../../../../lib/prisma';
import AppDataSource from '../../../../lib/data-source';
import { Account } from '../../../../entities/Account';
import { BankDetails } from '../../../../entities/BankDetails';
import { hashPassword } from '../../../../lib/auth';
import { notify } from '../../../../lib/notification';

export async function createOrUpdateUserFromMetadata(metadata: any): Promise<any> {
  const email = metadata.email as string | undefined;
  const hashedTemporaryPassword = metadata.hashedTemporaryPassword as string | undefined;

  if (!email || !hashedTemporaryPassword) {
    throw new Error('Missing email or hashedTemporaryPassword in metadata');
  }

  const userData: any = {
    email,
    password: hashedTemporaryPassword,
    passwordIsTemporary: true,
    firstName: metadata.firstName || null,
    lastName: metadata.lastName || null,
    phone: metadata.phone || null,
    dateOfBirth: metadata.dateOfBirth || null,
    gender: metadata.gender || null,
    maritalStatus: metadata.maritalStatus || null,
    spouseName: metadata.spouseName || null,
    spouseDob: metadata.spouseDob || null,
    children: Array.isArray(metadata.children) ? metadata.children : null,
    numberOfChildren: Array.isArray(metadata.children) ? metadata.children.length : null,
    nationalId: metadata.nationalId || null,
    address: metadata.address || null,
    city: metadata.city || null,
    country: metadata.country || null,
    occupation: metadata.occupation || null,
    employer: metadata.employer || null,
    salary: typeof metadata.salary === 'string' ? Number(metadata.salary) : metadata.salary ?? null,
    contributionRate: typeof metadata.contributionRate === 'string' ? Number(metadata.contributionRate) : metadata.contributionRate ?? null,
    retirementAge: typeof metadata.retirementAge === 'string' ? Number(metadata.retirementAge) : metadata.retirementAge ?? null,
    role: 'customer',
    ...(metadata.hashedPin ? { pin: metadata.hashedPin } : {}),
  };

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: userData });
    console.log(`[Payment Callback] Created user ${user.id}`);
  } else {
    await prisma.user.update({ where: { email }, data: userData });
    user = await prisma.user.findUnique({ where: { email } });
    console.log(`[Payment Callback] Updated existing user ${user.id}`);
  }

  return user;
}

export async function createOrReuseAccount(userId: string, metadata: any): Promise<any> {
  const accountRepo = AppDataSource.getRepository(Account);
  const acctType = metadata.accountType || 'MANDATORY';

  let createdAccount: any = null;
  const existing = await accountRepo.findOne({ where: { userId, accountType: acctType } });
  
  if (existing) {
    createdAccount = existing;
    if (!createdAccount.accountNumber) {
      createdAccount.accountNumber = String(createdAccount.id).padStart(8, '0');
      await accountRepo.save(createdAccount);
    }
    console.log(`[Payment Callback] Re-used account ${createdAccount.id}`);
  } else {
    const account = accountRepo.create({
      userId,
      accountType: acctType,
      accountStatus: metadata.accountStatus || 'ACTIVE',
      riskProfile: metadata.riskProfile || 'MEDIUM',
      currency: metadata.currency || 'KES',
      openedAt: new Date(),
      currentBalance: 0,
      availableBalance: 0,
      lockedBalance: 0,
      kycVerified: metadata.kycVerified || false,
      complianceStatus: metadata.complianceStatus || 'PENDING',
    });
    createdAccount = await accountRepo.save(account);

    // Save bank details if provided
    if (metadata.bankAccountName || metadata.bankAccountNumber || metadata.bankBranchName || metadata.bankBranchCode) {
      try {
        const bankDetailsRepo = AppDataSource.getRepository(BankDetails);
        const bd = bankDetailsRepo.create({
          accountId: createdAccount.id,
          bankAccountName: metadata.bankAccountName ?? null,
          bankAccountNumber: metadata.bankAccountNumber ?? null,
          bankBranchName: metadata.bankBranchName ?? null,
          bankBranchCode: metadata.bankBranchCode ?? null,
        });
        await bankDetailsRepo.save(bd);
      } catch (bdErr) {
        console.error('[Payment Callback] Failed to save bank details:', bdErr);
      }
    }

    if (!createdAccount.accountNumber) {
      const padded = String(createdAccount.id).padStart(8, '0');
      createdAccount.accountNumber = padded;
      await accountRepo.save(createdAccount);
    }
    console.log(`[Payment Callback] Created account ${createdAccount.id}`);
  }

  return createdAccount;
}

export async function sendWelcomeNotifications(email: string, phone: string, firstName: string, temporaryPasswordPlain: string) {
  try {
    await notify({
      to: email,
      channel: 'email',
      template: 'welcome',
      data: {
        name: firstName || 'User',
        temp_password: temporaryPasswordPlain,
        link: process.env.FRONTEND_URL || 'https://transactions-k6gk.onrender.com/login',
      },
    });
    console.log(`[Payment Callback] Sent welcome email to ${email}`);
  } catch (emailError) {
    console.error(`[Payment Callback] Failed sending email:`, emailError);
  }

  try {
    await notify({
      to: phone,
      channel: 'sms',
      template: 'welcome',
      data: {
        name: firstName || 'User',
        temp_password: temporaryPasswordPlain,
        link: process.env.FRONTEND_URL || 'https://transactions-k6gk.onrender.com/login',
      },
    });
    console.log(`[Payment Callback] Sent welcome SMS to ${phone}`);
  } catch (smsError) {
    console.error(`[Payment Callback] Failed sending SMS:`, smsError);
  }
}
