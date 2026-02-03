import { IsEmail, IsString } from 'class-validator';

export class ZohoProfileDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;
  
  @IsString()
  lastName: string;
}