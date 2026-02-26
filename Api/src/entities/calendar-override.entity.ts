import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarOverrideType } from '@/common/enums/calendar-override-type.enum';

@Entity('calendar_overrides')
export class CalendarOverride {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ApiProperty({ example: '2026-09-02', description: 'Override date' })
  @Column({ type: 'date', unique: true })
  date: string;

  @ApiProperty({ enum: CalendarOverrideType, example: CalendarOverrideType.HOLIDAY })
  @Column({ type: 'varchar', length: 30 })
  type: string;

  @ApiPropertyOptional({ example: 'Independence Day' })
  @Column({ type: 'varchar', length: 200, nullable: true })
  name: string | null;

  @ApiProperty({ example: 2026 })
  @Column({ type: 'int' })
  year: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
