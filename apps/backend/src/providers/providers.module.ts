import { Module, Global } from '@nestjs/common';
import { SMS_PROVIDER } from './sms/sms.interface';
import { MockSMSProvider } from './sms/mock-sms.provider';
import { HubtelSMSProvider } from './sms/hubtel-sms.provider';
import { MAPS_PROVIDER } from './maps/maps.interface';
import { HaversineMapsProvider } from './maps/haversine-maps.provider';
import { PAYMENT_PROVIDER } from './payments/payment.interface';
import { MockPaymentProvider } from './payments/mock-payment.provider';

@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: () => {
        const provider = process.env.SMS_PROVIDER || 'mock';
        switch (provider) {
          case 'hubtel':
            return new HubtelSMSProvider();
          default:
            return new MockSMSProvider();
        }
      },
    },
    {
      provide: MAPS_PROVIDER,
      useFactory: () => {
        // For now, only Haversine is implemented
        return new HaversineMapsProvider();
      },
    },
    {
      provide: PAYMENT_PROVIDER,
      useFactory: () => {
        // For now, only mock is implemented
        return new MockPaymentProvider();
      },
    },
  ],
  exports: [SMS_PROVIDER, MAPS_PROVIDER, PAYMENT_PROVIDER],
})
export class ProvidersModule {}
