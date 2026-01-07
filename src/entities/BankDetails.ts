import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Account } from './Account';

@Entity({ name: 'bank_details' })
export class BankDetails {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  @Index()
  accountId!: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  bankAccountName?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  bankBranchName?: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  bankBranchCode?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  bankAccountNumber?: string;

  @ManyToOne(() => Account, (account) => account.bankDetails, { onDelete: 'CASCADE' })
  account!: Account;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
