import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtDayType } from '@/common/enums/ot-day-type.enum';

@Entity('ot_types')
export class OtType {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @ApiProperty({ enum: OtDayType, example: OtDayType.WEEKDAY, description: 'Unique OT day type' })
  @Column({ name: 'day_type', type: 'enum', enum: OtDayType, unique: true, nullable: false })
  dayType: OtDayType;

  @ApiPropertyOptional({ example: 'Day OT on standard working days' })
  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;
}
