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
    vi.stubEnv('JWT_ACCESS_SECRET', 'production-access-secret-32-characters');
    vi.stubEnv('JWT_REFRESH_SECRET', 'production-refresh-secret-32-characters');
    vi.stubEnv('REDIS_URL', 'rediss://default:secret@redis.example.com:6379');
    vi.stubEnv('WEB_CORS_ORIGINS', 'https://admin.example.com,https://track.example.com');
    vi.stubEnv('SMS_PROVIDER', 'textbee');
    vi.stubEnv('TEXTBEE_API_KEY', 'textbee-secret');
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

describe('production TextBee configuration', () => {
  function stubProduction() {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost:5432/kansride');
    vi.stubEnv('JWT_ACCESS_SECRET', 'production-access-secret-32-characters');
    vi.stubEnv('JWT_REFRESH_SECRET', 'production-refresh-secret-32-characters');
    vi.stubEnv('REDIS_URL', 'rediss://default:secret@redis.example.com:6379');
    vi.stubEnv('WEB_CORS_ORIGINS', 'https://admin.example.com,https://track.example.com');
    vi.stubEnv('PAYMENT_PROVIDER', 'disabled');
    vi.stubEnv('SMS_PROVIDER', 'textbee');
  }

  it('requires a server-side TextBee key', async () => {
    stubProduction(); vi.stubEnv('TEXTBEE_API_KEY', ''); vi.resetModules();
    const { getEnv } = await import('../src/env');
    expect(() => getEnv()).toThrow('TEXTBEE_API_KEY');
  });

  it('accepts TextBee when its key is configured', async () => {
    stubProduction(); vi.stubEnv('TEXTBEE_API_KEY', 'textbee-secret'); vi.resetModules();
    const { getEnv } = await import('../src/env');
    expect(getEnv().SMS_PROVIDER).toBe('textbee');
  });
});

describe('production infrastructure safeguards', () => {
  async function production(overrides: Record<string, string>) {
    const defaults = {
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://user:password@localhost:5432/kansride',
      JWT_ACCESS_SECRET: 'production-access-secret-32-characters',
      JWT_REFRESH_SECRET: 'production-refresh-secret-32-characters',
      REDIS_URL: 'rediss://default:secret@redis.example.com:6379',
      WEB_CORS_ORIGINS: 'https://admin.example.com',
      PAYMENT_PROVIDER: 'disabled', SMS_PROVIDER: 'textbee', TEXTBEE_API_KEY: 'server-only-key',
    };
    for (const [key, value] of Object.entries({ ...defaults, ...overrides })) vi.stubEnv(key, value);
    vi.resetModules();
    return (await import('../src/env')).getEnv;
  }

  it('refuses in-memory Redis in production', async () => {
    expect(await production({ REDIS_URL: '' })).toThrow('REDIS_URL');
  });
  it('rejects a Redis REST URL', async () => {
    expect(await production({ REDIS_URL: 'https://redis.example.com' })).toThrow('redis:// or rediss://');
  });
  it('refuses simulated SMS delivery in production', async () => {
    expect(await production({ SMS_PROVIDER: 'mock' })).toThrow('live SMS_PROVIDER');
  });
  it('requires explicit production CORS', async () => {
    expect(await production({ WEB_CORS_ORIGINS: '' })).toThrow('WEB_CORS_ORIGINS');
    expect(await production({ WEB_CORS_ORIGINS: '*' })).toThrow('explicit HTTP(S) origins');
    expect(await production({ WEB_CORS_ORIGINS: 'https://admin.example.com/dashboard' })).toThrow('without paths');
  });
  it('rejects short or shared signing secrets', async () => {
    expect(await production({ JWT_ACCESS_SECRET: 'short' })).toThrow('32 characters');
    expect(await production({ JWT_REFRESH_SECRET: 'production-access-secret-32-characters' })).toThrow('distinct');
  });
});
