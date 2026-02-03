import { UserRole } from '../../common/enums/roles.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { IsEmail, IsString, IsNumber, Length, IsEnum } from 'class-validator';
export class LoginResponseDto {
  @IsString()
  @Length(1, 500)
  accessToken: string;
  
  @IsString()
  @Length(1, 500)
  refreshToken: string;


  user: {
    
    id: number;
   
    email: string;
   
    username: string;
    
    role: UserRole;

    status: UserStatus;
  };
}
