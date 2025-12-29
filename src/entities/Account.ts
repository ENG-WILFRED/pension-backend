import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './User';
import { Transaction } from './Transaction';

@Entity({ name: 'accounts' })
export class Account {
  // ========== Core Identification Fields ==========
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ unique: true, nullable: true })
  accountNumber?: string;

  // Bank details (optional)
  @Column({ type: 'varchar', length: 200, nullable: true })
  bankAccountName?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  bankBranchName?: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  bankBranchCode?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  bankAccountNumber?: string;

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: 'CASCADE' })
  user!: User;

  // ========== Account Classification Fields ==========
  @Column({
    type: 'enum',
    enum: ['MANDATORY', 'VOLUNTARY', 'EMPLOYER', 'SAVINGS', 'WITHDRAWAL', 'BENEFITS'],
    default: 'MANDATORY',
  })
  accountType!: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'SUSPENDED', 'CLOSED', 'FROZEN', 'DECEASED'],
    default: 'ACTIVE',
  })
  accountStatus!: string;

  // ========== Balance Fields ==========
  // Formula consistency: current_balance = available_balance + locked_balance
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  currentBalance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  availableBalance!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  lockedBalance!: number;

  // ========== Contribution Tracking Balances ==========
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  employeeContributions!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  employerContributions!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  voluntaryContributions!: number;

  // ========== Earnings & Growth Fields ==========
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  interestEarned!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  investmentReturns!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  dividendsEarned!: number;

  // ========== Withdrawal & Penalty Tracking ==========
  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  totalWithdrawn!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  penaltiesApplied!: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  taxWithheld!: number;

  // ========== Interest / Investment Configuration ==========
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  interestRate?: number;

  @Column({ type: 'uuid', nullable: true })
  investmentPlanId?: string;

  @Column({
    type: 'enum',
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    default: 'MEDIUM',
  })
  riskProfile!: string;

  // ========== Temporal & Lifecycle Fields ==========
  @Column({ type: 'timestamp with time zone', nullable: true })
  openedAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastContributionAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastWithdrawalAt?: Date;

  @Column({ type: 'date', nullable: true })
  maturityDate?: string;

  @Column({ type: 'date', nullable: true })
  retirementDate?: string;

  // ========== Audit & Integrity Fields ==========
  @Column({ type: 'uuid', nullable: true })
  lastTransactionId?: string;

  @Column({ type: 'int', default: 0 })
  version!: number;

  // ========== Regulatory & Compliance Fields ==========
  @Column({ type: 'boolean', default: false })
  kycVerified!: boolean;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
    default: 'PENDING',
  })
  complianceStatus!: string;

  @Column({ type: 'boolean', default: false })
  isTaxExempt!: boolean;

  // ========== Optional Future-Proofing Fields ==========
  @Column({ type: 'varchar', length: 3, default: 'KES' })
  currency!: string;

  @Column({ type: 'varchar', length: 2, default: 'KE' })
  countryCode!: string;

  @Column({ type: 'json', nullable: true })
  beneficiaryDetails?: any;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  // ========== Timestamps ==========
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // ========== Relations ==========
  @OneToMany(() => Transaction, (transaction) => transaction.account)
  transactions!: Transaction[];
}
