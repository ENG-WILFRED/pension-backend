import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Transaction } from '../entities/Transaction';
import { Account } from '../entities/Account';
import { TermsAndConditions } from '../entities/TermsAndConditions';
import { AccountType } from '../entities/AccountType';
import { Report } from '../entities/Report';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

// Determine whether to enable SSL for the Postgres connection.
// Some hosted Postgres providers require SSL even in non-production environments.
const dbUrlIncludesSsl = DATABASE_URL ? DATABASE_URL.includes('sslmode=require') || DATABASE_URL.includes('sslmode=verify-full') : false;
const envRequestsSsl = (process.env.DB_SSL || process.env.PGSSLMODE) === 'true' || process.env.PGSSLMODE === 'require' || process.env.PGSSLMODE === 'verify-full';
const enableSsl = process.env.NODE_ENV === 'production' || dbUrlIncludesSsl || envRequestsSsl;

export default new DataSource({
  type: 'postgres',
  url: DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: [User, Transaction, Account, TermsAndConditions, AccountType, Report],
  migrations: ['dist/migrations/*.js'],
  subscribers: [],
  ssl: enableSsl ? { rejectUnauthorized: false } : false,
});
