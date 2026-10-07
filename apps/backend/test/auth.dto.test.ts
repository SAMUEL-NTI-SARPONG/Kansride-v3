import { describe, expect, it } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { LoginPINDTO, PhoneDTO, VerifyOTPDTO, PassengerRegistrationDTO, RegisterPassengerDTO } from '../src/modules/auth/auth.dto';
import { DriverApplicationDTO } from '../src/modules/drivers/driver-application.dto';

const pipe = new ValidationPipe({ whitelist: true, transform: true });
describe('authentication input validation', () => {
  it('strips approval/role/session flags from public passenger registration', async () => {
    expect(await pipe.transform({ fullName: 'Ama Owusu', phoneNumber: '0501234567', pin: '0123', role: 'super_admin', isVerified: true, activeSessionId: 'forged' }, { type: 'body', metatype: RegisterPassengerDTO }))
      .toEqual({ fullName: 'Ama Owusu', phoneNumber: '0501234567', pin: '0123' });
  });
  it('requires driver application fields and rejects oversized photos', async () => {
    await expect(pipe.transform({ phoneNumber: '0501234567', pin: '0123' }, { type: 'body', metatype: DriverApplicationDTO })).rejects.toThrow();
    await expect(pipe.transform({ driverPhoto: 'x'.repeat(1_500_001) }, { type: 'body', metatype: DriverApplicationDTO })).rejects.toThrow();
  });
  it('rejects missing, numeric, or object phone fields before calling a service', async () => {
    for (const input of [{}, { phoneNumber: 233501234567 }, { phoneNumber: {} }]) {
      await expect(pipe.transform(input, { type: 'body', metatype: PhoneDTO })).rejects.toThrow();
    }
  });
  it('keeps leading zeroes in a valid PIN and removes unexpected fields', async () => {
    expect(await pipe.transform({ phoneNumber: '0501234567', pin: '0123', role: 'super_admin' }, { type: 'body', metatype: LoginPINDTO })).toEqual({ phoneNumber: '0501234567', pin: '0123' });
  });
  it('rejects malformed verification codes and excessive registration data', async () => {
    await expect(pipe.transform({ phoneNumber: '0501234567', code: '123' }, { type: 'body', metatype: VerifyOTPDTO })).rejects.toThrow();
    await expect(pipe.transform({ fullName: 'x'.repeat(161), pin: '1234' }, { type: 'body', metatype: PassengerRegistrationDTO })).rejects.toThrow();
  });
});
