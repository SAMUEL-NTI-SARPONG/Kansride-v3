import { Module, Global } from '@nestjs/common';
import { getEnv } from '@kansride/config';
import { SMS_PROVIDER } from './sms/sms.interface';
import { MockSMSProvider } from './sms/mock-sms.provider';
import { HubtelSMSProvider } from './sms/hubtel-sms.provider';
import { MAPS_PROVIDER } from './maps/maps.interface';
import { HaversineMapsProvider } from './maps/haversine-maps.provider';
import { PAYMENT_PROVIDER } from './payments/payment.interface';
import { MockPaymentProvider } from './payments/mock-payment.provider';
import { DisabledPaymentProvider } from './payments/disabled-payment.provider';
import { TextBeeSMSProvider } from './sms/textbee-sms.provider';
import { DATABASE_TOKEN } from '../database';
import type { Database } from '@kansride/db';

@Global()
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      inject: [DATABASE_TOKEN],
      useFactory: (db: Database) => {
        const provider = process.env.SMS_PROVIDER || 'mock';
        switch (provider) {
          case 'hubtel':
            return new HubtelSMSProvider();
          case 'textbee':
            return new TextBeeSMSProvider(db);
          default:
            return new MockSMSProvider();
        }
      },
    },
    {
      provide: MAPS_PROVIDER,
      useFactory: () => {
        const provider = getEnv().MAPS_PROVIDER;
        if (provider !== 'openstreetmap') {
          throw new Error(`MAPS_PROVIDER=${provider} is not implemented`);
        }
        return new HaversineMapsProvider();
      },
    },
    {
      provide: PAYMENT_PROVIDER,
      useFactory: () => {
        const provider = getEnv().PAYMENT_PROVIDER;
        switch (provider) {
          case 'mock':
            return new MockPaymentProvider();
          case 'disabled':
            return new DisabledPaymentProvider();
          default:
            throw new Error(`PAYMENT_PROVIDER=${provider} is not implemented`);
        }
      },
    },
  ],
  exports: [SMS_PROVIDER, MAPS_PROVIDER, PAYMENT_PROVIDER],
})
export class ProvidersModule {}
