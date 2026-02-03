import { IsEmail } from "class-validator";

export class LoginEmailDto {
  @IsEmail()
  email: string;
}
