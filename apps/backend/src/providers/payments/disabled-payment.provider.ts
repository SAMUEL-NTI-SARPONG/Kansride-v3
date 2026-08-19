import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  IPaymentProvider,
  PaymentInitResult,
  PaymentMethod,
  PaymentVerifyResult,
} from './payment.interface';

export const PAYMENTS_TEMPORARILY_UNAVAILABLE_MESSAGE =
  'Payments are temporarily unavailable. Please contact KansRide support.';

/**
 * Explicit production-safe V1 provider for deployments with online payments
 * turned off. It never creates references or returns a successful result.
 */
@Injectable()
export class DisabledPaymentProvider implements IPaymentProvider {
  async initiate(
    _amountPesewas: number,
    _method: PaymentMethod,
    _phoneNumber: string,
    _description: string
  ): Promise<PaymentInitResult> {
    throw new ServiceUnavailableException(PAYMENTS_TEMPORARILY_UNAVAILABLE_MESSAGE);
  }

  async verify(_reference: string): Promise<PaymentVerifyResult> {
    throw new ServiceUnavailableException(PAYMENTS_TEMPORARILY_UNAVAILABLE_MESSAGE);
  }
}
