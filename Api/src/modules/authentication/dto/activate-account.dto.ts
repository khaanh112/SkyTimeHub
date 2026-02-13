import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ActivateAccountDto {
  @ApiProperty({ example: 'abc123def456', description: 'Account activation token' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  token: string;
}
