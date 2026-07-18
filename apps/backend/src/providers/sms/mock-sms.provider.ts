import { Injectable, Logger } from '@nestjs/common';
import { ISMSProvider } from './sms.interface';

@Injectable()
export class MockSMSProvider implements ISMSProvider {
  private readonly logger = new Logger('MockSMS');

  async sendOTP(phoneNumber: string, code: string): Promise<{ success: boolean; messageId?: string }> {
    this.logger.log(`[MOCK SMS] OTP ${code} sent to ${phoneNumber}`);
    return { success: true, messageId: `mock-${Date.now()}` };
  }
}
