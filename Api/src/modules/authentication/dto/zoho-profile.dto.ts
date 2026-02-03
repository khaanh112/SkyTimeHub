import { IsEmail, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ZohoProfileDto {
  @ApiProperty({ example: 'user@zoho.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'https://zoho.com/avatar.jpg', required: false })
  @IsString()
  @IsOptional()
  picture?: string;
}

/**
 * Interface for raw Zoho API user info response
 */
export interface ZohoUserInfo {
  Email: string;
  First_Name: string;
  Last_Name: string;
  picture?: string;
  ZUID?: string;
}

/**
 * Interface for processed Zoho profile with tokens
 */
export interface ZohoProfile {
  email: string;
  firstName: string;
  lastName: string;
  picture: string;
  accessToken: string;
  refreshToken: string;
}
