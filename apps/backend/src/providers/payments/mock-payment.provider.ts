import { Injectable, Logger } from '@nestjs/common';
import { IPaymentProvider, PaymentMethod, PaymentInitResult, PaymentVerifyResult } from './payment.interface';

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger('MockPayment');
  private readonly payments = new Map<string, { amountPesewas: number; status: 'pending' | 'success' | 'failed' }>();

  async initiate(amountPesewas: number, method: PaymentMethod, phoneNumber: string, description: string): Promise<PaymentInitResult> {
    const reference = `mock-pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.logger.log(`[MOCK] Payment initiated: ${amountPesewas} pesewas via ${method} from ${phoneNumber} — ${description}`);
    
    // Auto-succeed after storing
    this.payments.set(reference, { amountPesewas, status: 'success' });
    
    return { reference, status: 'success' };
  }

  async verify(reference: string): Promise<PaymentVerifyResult> {
    const payment = this.payments.get(reference);
    if (!payment) {
      return { status: 'failed', amountPesewas: 0, reference };
    }
    return { status: payment.status, amountPesewas: payment.amountPesewas, reference };
  }
}
