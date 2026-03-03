import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginEmailDto {
  @ApiProperty({ example: 'maikhaanh11205@gmail.com', description: 'User email address' })
  @IsEmail()
  email: string;
}
