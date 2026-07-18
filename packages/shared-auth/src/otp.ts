import { createHash, randomInt } from 'crypto';

export class OTPService {
  generateOTP(length = 6): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return randomInt(min, max).toString();
  }

  hashOTP(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  verifyOTP(plainOTP: string, hashedOTP: string): boolean {
    const hash = this.hashOTP(plainOTP);
    return hash === hashedOTP;
  }

  isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  canAttempt(attempts: number, maxAttempts: number): boolean {
    return attempts < maxAttempts;
  }

  createExpiryDate(minutesFromNow: number): Date {
    return new Date(Date.now() + minutesFromNow * 60 * 1000);
  }
}
