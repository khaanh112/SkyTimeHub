import { IsOptional, IsEnum, IsString, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OtPlanStatus } from '@/common/enums/ot-plan-status.enum';

export enum OtPlanView {
  PERSONAL = 'personal',
  MANAGEMENT = 'management',
}

export class ListOtPlansQueryDto {
  @ApiPropertyOptional({
    enum: OtPlanView,
    default: OtPlanView.PERSONAL,
    description: 'personal = own plans, management = team/all plans',
  })
  @IsOptional()
  @IsEnum(OtPlanView)
  view?: OtPlanView = OtPlanView.PERSONAL;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, enum: [10, 20, 50] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  /** Multi-select status filter: ?status=pending,approved */
  @ApiPropertyOptional({
    description: 'Comma-separated statuses',
    example: 'pending,approved',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const arr = (typeof value === 'string' ? value.split(',') : value) as string[];
    return arr.map((s) => s.trim().toLowerCase());
  })
  status?: OtPlanStatus[];

  /** Date range – from (inclusive) */
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Date range – to (inclusive) */
  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  /** Free-text search (title, department name, plan code) */
  @ApiPropertyOptional({ example: 'March plan' })
  @IsOptional()
  @IsString()
  q?: string;

  /**
   * Sort field with optional `-` prefix for DESC.
   * Allowed: createdAt, title
   * Default: -createdAt (latest first)
   */
  @ApiPropertyOptional({ example: '-createdAt', default: '-createdAt' })
  @IsOptional()
  @IsString()
  sort?: string = '-createdAt';
}
