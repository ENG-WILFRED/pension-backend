import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { User } from './User';

@Entity({ name: 'transactions' })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  @Index()
  userId?: string;

  @ManyToOne(() => User, (user: { transactions: any; }) => user.transactions, { onDelete: 'CASCADE' })
  user?: User;

  @Column('double precision')
  amount!: number;

  @Column()
  type!: string;

  @Column({ default: 'pending' })
  status!: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true, unique: true })
  mpesaCheckoutId?: string;

  @Column({ nullable: true, unique: true })
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
