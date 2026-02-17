import dotenv from 'dotenv';
import AppDataSource from '../lib/data-source';
import { AccountType } from '../entities/AccountType';
import { TermsAndConditions } from '../entities/TermsAndConditions';

dotenv.config();

async function run() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const accountTypeRepo = AppDataSource.getRepository(AccountType);
    const tcRepo = AppDataSource.getRepository(TermsAndConditions);

    const defaultAccountTypes = [
      { name: 'MANDATORY', description: 'Mandatory pension contributions' },
      { name: 'VOLUNTARY', description: 'Voluntary contributions' },
      { name: 'EMPLOYER', description: 'Employer contributions' },
      { name: 'SAVINGS', description: 'Savings account' },
      { name: 'WITHDRAWAL', description: 'Withdrawals' },
      { name: 'BENEFITS', description: 'Benefits' },
    ];

    for (const t of defaultAccountTypes) {
      const exists = await accountTypeRepo.findOne({ where: { name: t.name } });
      if (!exists) {
        const at = accountTypeRepo.create({ ...t, active: true });
        await accountTypeRepo.save(at);
        console.log('Inserted account type', t.name);
      } else {
        console.log('Account type exists, skipping', t.name);
      }
    }

    const existingTc = await tcRepo.count();
    if (existingTc === 0) {
      const tc = tcRepo.create({ body: 'Default terms and conditions.' });
      await tcRepo.save(tc);
      console.log('Inserted default terms and conditions');
    } else {
      console.log('Terms and conditions already present, skipping');
    }

    console.log('Seed completed');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed', err);
    process.exit(1);
  }
}

run();
