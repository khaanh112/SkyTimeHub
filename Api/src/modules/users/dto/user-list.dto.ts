import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@/common/enums/roles.enum';
import { UserStatus } from '@common/enums/user-status.enum';
import { ContractType } from '@common/enums/contract-type.enum';

export class UserListItemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: UserRole.EMPLOYEE })
  role: UserRole;

  @ApiProperty({ example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: ContractType.OFFICIAL })
  contractType: ContractType;
}

export class PageMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 53 })
  total: number;
}

// ── Full paginated response (returned as-is to bypass TransformInterceptor) ──

export class UserListResponseDto {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ type: [UserListItemDto] })
  data: UserListItemDto[];

  @ApiProperty({ type: PageMetaDto })
  page: PageMetaDto;
}
