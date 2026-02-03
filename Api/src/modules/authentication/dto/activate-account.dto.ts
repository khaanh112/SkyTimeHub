import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateAccountDto {
  @ApiProperty({ example: 'abc123def456', description: 'Account activation token' })
  @IsNotEmpty()
  @IsString()
  token: string;
}
