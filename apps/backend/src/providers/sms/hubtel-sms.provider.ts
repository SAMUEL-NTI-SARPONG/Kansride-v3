import { Injectable, Logger } from '@nestjs/common';
import { ISMSProvider } from './sms.interface';

@Injectable()
export class HubtelSMSProvider implements ISMSProvider {
  private readonly logger = new Logger('HubtelSMS');
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor() {
    this.apiKey = process.env.HUBTEL_SMS_API_KEY || '';
    this.senderId = process.env.HUBTEL_SENDER_ID || 'KansRide';
  }

  async sendOTP(phoneNumber: string, code: string): Promise<{ success: boolean; messageId?: string }> {
    const message = `Your KansRide verification code is: ${code}. Valid for 10 minutes.`;
    
    try {
      // Hubtel SMS API call
      const response = await fetch('https://smsc.hubtel.com/v1/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
        },
        body: JSON.stringify({
          From: this.senderId,
          To: phoneNumber,
          Content: message,
        }),
      });

      if (!response.ok) {
        this.logger.error(`Hubtel SMS failed: ${response.status}`);
        return { success: false };
      }

      const data = await response.json() as { MessageId?: string };
      return { success: true, messageId: data.MessageId };
    } catch (error) {
      this.logger.error(`Hubtel SMS error: ${(error as Error).message}`);
      return { success: false };
    }
  }
}
