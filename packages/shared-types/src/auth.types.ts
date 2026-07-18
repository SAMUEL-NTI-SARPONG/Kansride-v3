export type UserRole =
  | 'passenger'
  | 'driver_applicant'
  | 'driver'
  | 'dispatcher'
  | 'support_agent'
  | 'finance_officer'
  | 'safety_officer'
  | 'ops_admin'
  | 'system_admin'
  | 'super_admin'
  | 'auditor';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'banned';

export interface User {
  id: string;
  phoneNumber: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  status: UserStatus;
  isVerified: boolean;
  profilePhotoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface OTPPayload {
  phoneNumber: string;
  otpCode: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
}

export interface JWTPayload {
  userId: string;
  phoneNumber: string;
  role: UserRole;
  iat: number;
  exp: number;
}
