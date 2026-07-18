export type PaymentMethod = 'mtn_mobile_money' | 'telecel_cash' | 'at_money' | 'cash';

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
