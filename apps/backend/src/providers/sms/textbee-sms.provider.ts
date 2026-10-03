import { Logger } from '@nestjs/common';
import { appSettings, type Database } from '@kansride/db';
import { eq } from 'drizzle-orm';
import { ISMSProvider } from './sms.interface';

export const OTP_SMS_SETTINGS_KEY = 'otp_sms';
export type OTPSMSSettings = { enabled: boolean; deviceId?: string; simSubscriptionId?: number; sendingPhoneLabel: string };
export const DEFAULT_OTP_SMS_SETTINGS: OTPSMSSettings = { enabled: true, sendingPhoneLabel: '+233 54 698 8890' };

export class TextBeeSMSProvider implements ISMSProvider {
  private readonly logger = new Logger('TextBeeSMS');
  constructor(private readonly db: Database, private readonly apiKey = process.env.TEXTBEE_API_KEY || '') {}
  async sendOTP(phoneNumber: string, code: string): Promise<{ success: boolean; messageId?: string }> {
    const [row] = await this.db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, OTP_SMS_SETTINGS_KEY)).limit(1);
    const settings = { ...DEFAULT_OTP_SMS_SETTINGS, ...((row?.value || {}) as Partial<OTPSMSSettings>) };
    if (!settings.enabled || !this.apiKey) return { success: false };
    const payload: Record<string, unknown> = { recipients: [phoneNumber], message: `Your KansRide verification code is ${code}. It expires in 10 minutes.` };
    if (settings.deviceId) payload.deviceId = settings.deviceId;
    if (Number.isInteger(settings.simSubscriptionId)) payload.simSubscriptionId = settings.simSubscriptionId;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey }, body: JSON.stringify(payload), signal: controller.signal });
      const body = await response.json().catch(() => ({})) as { data?: { success?: boolean; smsBatchId?: string; successCount?: number } };
      const accepted = response.ok && (body.data?.success === true || Boolean(body.data?.smsBatchId) || Number(body.data?.successCount) > 0);
      if (!accepted) this.logger.error(`TextBee rejected OTP send with HTTP ${response.status}`);
      return { success: accepted, messageId: body.data?.smsBatchId };
    } catch (error) {
      this.logger.error(`TextBee OTP send failed: ${error instanceof Error ? error.message : 'network error'}`);
      return { success: false };
    } finally { clearTimeout(timeout); }
  }
}
