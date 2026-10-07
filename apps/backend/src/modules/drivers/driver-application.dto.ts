import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class DriverApplicationDTO {
  @IsString() @Length(9, 24) phoneNumber!: string;
  @IsString() @Length(1, 100) firstName!: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsString() @Length(1, 50) ghanaCardNumber!: string;
  @IsString() @Length(1, 30) vehicleRegistration!: string;
  @IsString() @Length(1, 50) vehicleColour!: string;
  @IsString() @Length(1, 100) vehicleMake!: string;
  @IsString() @Length(1, 100) vehicleModel!: string;
  @IsString() @Length(1, 255) placeOfStay!: string;
  @IsString() @Length(1, 80) communityId!: string;
  @IsString() @MaxLength(1_500_000) driverPhoto!: string;
  @IsString() @Length(1, 160) emergencyContactName!: string;
  @IsString() @Length(9, 24) emergencyPhoneNumber!: string;
  @IsString() @Matches(/^\d{4}$/) pin!: string;
}
