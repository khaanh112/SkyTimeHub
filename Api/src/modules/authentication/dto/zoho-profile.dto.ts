import { IsEmail, IsString, IsOptional, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ZohoProfileDto {
  @ApiProperty({ example: 'user@zoho.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  lastName: string;

  @ApiProperty({ example: 'https://zoho.com/avatar.jpg', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 200)
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
