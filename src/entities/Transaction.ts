import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User } from './User';
import { Account } from './Account';

@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  @Index()
  userId?: string;

  @ManyToOne(() => User, (user: { transactions: any; }) => user.transactions, { onDelete: 'CASCADE' })
  user?: User;

  @Column({ type: 'int', nullable: true })
  @Index()
  accountId?: number;

  @ManyToOne(() => Account, (account) => account.transactions, { onDelete: 'CASCADE' })
  account?: Account;

  @Column('double precision')
  amount!: number;

  @Column({ nullable: true })
  title?: string;

  @Column()
  type!: string;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true, unique: true })
  mpesaCheckoutId?: string;

  @Column({ nullable: false })
  @Index()
  checkoutRequestId?: string;

  @Column({ nullable: true, unique: true })
  mpesaRef?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
