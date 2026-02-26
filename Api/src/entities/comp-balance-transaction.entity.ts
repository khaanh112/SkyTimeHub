import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompTxDirection } from '@/common/enums/comp-tx-direction.enum';
import { CompTxSource } from '@/common/enums/comp-tx-source.enum';
import { User } from './users.entity';

@Entity('comp_balance_transactions')
@Index('idx_comp_tx_employee_time', ['employeeId', 'createdAt'])
export class CompBalanceTransaction {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee: User;

  @ApiProperty({ enum: CompTxDirection, example: CompTxDirection.CREDIT })
  @Column({ type: 'enum', enum: CompTxDirection })
  direction: CompTxDirection;

  @ApiProperty({ example: 480, description: 'Amount in minutes (30-min steps, always positive)' })
  @Column({ name: 'amount_minutes', type: 'int' })
  amountMinutes: number;

  @ApiProperty({ enum: CompTxSource, example: CompTxSource.MAKEUP_APPROVAL })
  @Column({ name: 'source_type', type: 'enum', enum: CompTxSource })
  sourceType: CompTxSource;

  @ApiPropertyOptional({ description: 'Source record ID (comp_work_request.id, leave_request.id…)' })
  @Column({ name: 'source_id', type: 'bigint', nullable: true })
  sourceId: number | null;

  @ApiPropertyOptional({ description: 'Freetext note' })
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
