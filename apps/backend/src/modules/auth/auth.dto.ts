import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class PhoneDTO {
  @IsString()
  @Length(9, 24)
  phoneNumber!: string;
}

export class VerifyOTPDTO extends PhoneDTO {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class LoginPINDTO extends PhoneDTO {
  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;
}

export class PassengerRegistrationDTO {
  @IsString()
  @Length(1, 160)
  fullName!: string;

  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  communityId?: string;
}

export class RegisterPassengerDTO extends PassengerRegistrationDTO {
  @IsString()
  @Length(9, 24)
  phoneNumber!: string;
}

export class RefreshTokenDTO {
  @IsString()
  @Length(20, 4096)
  refreshToken!: string;
}
