import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Transaction } from './Transaction';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true, nullable: true })
  username?: string;

  @Column()
  password!: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ unique: true, nullable: false })
  phone?: string;

  // Personal details
  @Column({ type: 'date', nullable: true })
  dateOfBirth?: string;

  @Column({ nullable: true })
  gender?: string;

  @Column({ nullable: true })
  maritalStatus?: string;

  // Language preference (en or sw)
  @Column({ nullable: true })
  language?: string;

  // Spouse data
  @Column({ nullable: true })
  spouseName?: string;

  @Column({ type: 'date', nullable: true })
  spouseDob?: string;

  // Children - stored as simple JSON array of { name, dob }
  @Column({ type: 'simple-json', nullable: true })
  children?: Array<{ name?: string; dob?: string }>;

  @Column({ type: 'int', nullable: true })
  numberOfChildren?: number;

  // Login / security helpers
  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ nullable: true })
  otpCode?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  otpExpiry?: Date;

  // Identity and contact
  @Column({ nullable: true })
  nationalId?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  country?: string;

  // Employment / pension related
  @Column({ nullable: true })
  occupation?: string;

  @Column({ nullable: true })
  employer?: string;

  @Column({ type: 'decimal', nullable: true })
  salary?: number;

  @Column({ type: 'decimal', nullable: true })
  contributionRate?: number;

  @Column({ type: 'int', nullable: true })
  retirementAge?: number;

  // Role: 'customer' or 'admin' - new column. Default to 'customer' for all registrations.
  @Column({ default: 'customer' })
  role!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Transaction, (transaction) => transaction.user)
  transactions!: Transaction[];
}
