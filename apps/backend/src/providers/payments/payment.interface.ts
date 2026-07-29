import type { PaymentMethod } from '@kansride/types';

// Re-export the canonical PaymentMethod union from shared-types so the
// backend provider interface and every client share one source of truth.
// Previously this file declared its own (narrower) copy that diverged from
// shared-types by omitting... and previously by including 'wallet' on the
// shared side only — a client typed against shared-types could send a value
// the provider would not recognise.
export type { PaymentMethod };

export interface PaymentInitResult {
  reference: string;
  status: 'pending' | 'success' | 'failed';
  redirectUrl?: string;
}

export interface PaymentVerifyResult {
  status: 'pending' | 'success' | 'failed' | 'expired';
  amountPesewas: number;
  reference: string;
}

export interface IPaymentProvider {
  initiate(amountPesewas: number, method: PaymentMethod, phoneNumber: string, description: string): Promise<PaymentInitResult>;
  verify(reference: string): Promise<PaymentVerifyResult>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
