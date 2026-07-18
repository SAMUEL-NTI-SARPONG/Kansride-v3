export interface ISMSProvider {
  sendOTP(phoneNumber: string, code: string): Promise<{ success: boolean; messageId?: string }>;
}

export const SMS_PROVIDER = 'SMS_PROVIDER';
