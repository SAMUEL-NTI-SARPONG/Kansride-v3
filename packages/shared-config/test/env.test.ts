import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAppPort } from '../src/env';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('application port resolution', () => {
  it('uses Railway-style PORT when APP_PORT is absent', () => {
    expect(resolveAppPort({ PORT: '8080' })).toBe('8080');
  });

  it('keeps APP_PORT as the explicit override', () => {
    expect(resolveAppPort({ APP_PORT: '3000', PORT: '8080' })).toBe('3000');
  });
});

describe('production payment provider configuration', () => {
  function stubRequiredProductionEnvironment(paymentProvider: string) {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost:5432/kansride');
    vi.stubEnv('JWT_ACCESS_SECRET', 'production-access-secret');
    vi.stubEnv('JWT_REFRESH_SECRET', 'production-refresh-secret');
    vi.stubEnv('PAYMENT_PROVIDER', paymentProvider);
  }

  it('accepts disabled as an explicit production payment configuration', async () => {
    stubRequiredProductionEnvironment('disabled');
    vi.resetModules();

    const { getEnv } = await import('../src/env');

    expect(getEnv().PAYMENT_PROVIDER).toBe('disabled');
  });

  it('continues to reject the successful mock provider in production', async () => {
    stubRequiredProductionEnvironment('mock');
    vi.resetModules();

    const { getEnv } = await import('../src/env');

    expect(() => getEnv()).toThrow(
      '[ENV] PAYMENT_PROVIDER=mock is not permitted in production',
    );
  });
});
