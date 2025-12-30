import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ name: 'reports' })
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  type!: string; // 'transactions' | 'customer'

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  fileName?: string;

  @Column({ type: 'text', nullable: true })
  pdfBase64?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: any;

  @CreateDateColumn()
  createdAt!: Date;
}
