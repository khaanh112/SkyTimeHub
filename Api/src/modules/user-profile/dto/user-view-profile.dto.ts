import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@/common/enums/roles.enum';
import { ContractType } from '@/common/enums/contract-type.enum';

export class UserViewProfileDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'ST001' })
  employeeId: string;

  @ApiProperty({ example: 'Tran Thu Trang' })
  username: string;

  @ApiProperty({ example: 'trangtt@sky-solution.com' })
  email: string;

  @ApiPropertyOptional({ example: 'BA' })
  position: string | null;

  @ApiPropertyOptional({ example: 'Technology development dept' })
  departmentName: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.EMPLOYEE })
  role: UserRole;

  @ApiPropertyOptional({ enum: ContractType, example: ContractType.INTERN })
  contractType: ContractType | null;

  @ApiPropertyOptional({ example: '2025-12-12' })
  officialContractDate: Date | null;

  @ApiPropertyOptional({ example: '2025-11-30' })
  joinDate: Date | null;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  approverName: string | null;
}
