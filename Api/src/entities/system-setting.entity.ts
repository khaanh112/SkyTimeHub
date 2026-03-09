import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('system_settings')
export class SystemSetting {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'ot_policy', description: 'Setting category' })
  @Column({ type: 'varchar', length: 100, nullable: false })
  category: string;

  @ApiProperty({ example: 'max_ot_hours_per_day', description: 'Setting key' })
  @Column({ type: 'varchar', length: 100, nullable: false, unique: true })
  key: string;

  @ApiProperty({ example: '4', description: 'Setting value (stored as string)' })
  @Column({ type: 'text', nullable: false })
  value: string;

  @ApiPropertyOptional({ description: 'Human-readable description' })
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
