import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendActivationEmailDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address of the pending account' })
  @IsEmail()
  email: string;
}
