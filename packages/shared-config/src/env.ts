import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

let environmentLoaded = false;

/**
 * Load the repository-root .env for workspace commands without overwriting
 * variables already supplied by the process or CI environment.
 */
export function loadRootEnv(): void {
  if (environmentLoaded) return;
  environmentLoaded = true;

  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '..', '.env'),
  ];
  const envPath = candidates.find((candidate) => existsSync(candidate));
  if (envPath) {
    process.loadEnvFile(envPath);
  }
}

const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  APP_PORT: z.coerce.number().int().positive().default(3000),

// Database (PostgreSQL + PostGIS). DATABASE_URL must use the postgres(ql)
  // scheme — a generic URL would otherwise pass schema validation here and
  // fail later inside Drizzle with an opaque error. The shared-db loader has
  // its own equivalent check; this is the authoritative, fail-fast gate.
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().default('kansride'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default(''),
  DATABASE_URL: z
    .string()
    .url()
    .refine(
      (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
      'DATABASE_URL must use the postgresql:// scheme',
    ),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(1).default('change-this-to-a-strong-secret-in-production'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(1)
    .default('change-this-refresh-secret-in-production'),

  // SMS Provider. Only adapters that are actually implemented are enumerated;
  // an unrecognized value now fails fast at config load instead of silently
  // degrading to the mock sender (which would report OTP delivery as
  // successful when no real SMS was sent). The Hubtel provider reads
  // HUBTEL_SMS_API_KEY / HUBTEL_SENDER_ID directly (not the generic
  // SMS_API_KEY / SMS_API_SECRET below, which are reserved for future
  // providers); they are declared here so the schema validates and documents
  // them and so production can require the live secret.
  SMS_PROVIDER: z.enum(['mock', 'hubtel']).default('mock'),
  SMS_API_KEY: z.string().default(''),
  SMS_API_SECRET: z.string().default(''),
  HUBTEL_SMS_API_KEY: z.string().default(''),
  HUBTEL_SENDER_ID: z.string().default('KansRide'),

  // Maps. Haversine is the deterministic development adapter. Google mode is
  // reserved for the production adapter and must not silently fall back.
  MAPS_PROVIDER: z.enum(['openstreetmap', 'google']).default('openstreetmap'),
  MAPS_API_KEY: z.string().default(''),

  // Payments. Mock mode is deterministic for development/test only. Disabled
  // mode is the explicit production-safe V1 configuration and never reports a
  // successful payment. A live adapter remains credential-gated and fails
  // startup until implemented behind the existing IPaymentProvider interface.
  PAYMENT_PROVIDER: z.enum(['mock', 'disabled', 'momo']).default('mock'),
  PAYMENT_API_KEY: z.string().default(''),
  PAYMENT_API_SECRET: z.string().default(''),

  // Web CORS. Optional comma-separated list of allowed origins. When unset,
  // the API serves any origin without credentials (the V1 default). When set,
  // the API serves only those origins with credentials, which is required for
  // cookie/header-authenticated cross-origin web clients.
  WEB_CORS_ORIGINS: z.string().default(''),

  // Logging
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('debug'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/** Prefer the KansRide setting, then the port injected by hosts such as Railway. */
export function resolveAppPort(environment: NodeJS.ProcessEnv): string | undefined {
  return environment.APP_PORT || environment.PORT;
}

/**
 * Parses and validates environment variables against the schema.
 * Uses sensible defaults for development but fails fast in production
 * if required variables are missing.
 */
export function getEnv(): Env {
  loadRootEnv();

  if (cachedEnv) {
    return cachedEnv;
  }

  const isProduction = process.env['NODE_ENV'] === 'production';

// In production, require critical secrets to be explicitly set
  if (isProduction) {
    const requiredInProduction = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'DATABASE_URL',
    ] as const;

    const missing = requiredInProduction.filter(
      (key) => !process.env[key] || process.env[key] === ''
    );

    // When a real SMS provider is selected in production, require its live
    // secret. Without it the Hubtel adapter would send an empty Authorization
    // header, get a 401, and requestOTP would have surfaced the failure as a
    // successful "OTP sent" response (a real V1 defect — see the auth fix).
    if (process.env['SMS_PROVIDER'] === 'hubtel' && (!process.env['HUBTEL_SMS_API_KEY'] || process.env['HUBTEL_SMS_API_KEY'] === '')) {
      (missing as string[]).push('HUBTEL_SMS_API_KEY');
    }
    const paymentProvider = process.env['PAYMENT_PROVIDER'] || 'mock';
    if (paymentProvider === 'momo') {
      (missing as string[]).push('PAYMENT_API_KEY', 'PAYMENT_API_SECRET');
    }
    if (paymentProvider === 'mock') {
      throw new Error('[ENV] PAYMENT_PROVIDER=mock is not permitted in production');
    }
    if (process.env['MAPS_PROVIDER'] === 'google' && (!process.env['MAPS_API_KEY'] || process.env['MAPS_API_KEY'] === '')) {
      (missing as string[]).push('MAPS_API_KEY');
    }

    if (missing.length > 0) {
      throw new Error(
        `[ENV] Missing required environment variables in production: ${missing.join(', ')}`
      );
    }

    // Reject default/insecure secrets in production
    if (process.env['JWT_ACCESS_SECRET'] === 'change-this-to-a-strong-secret-in-production') {
      throw new Error('[ENV] JWT_ACCESS_SECRET must be changed from default value in production');
    }
    if (
      process.env['JWT_REFRESH_SECRET'] === 'change-this-refresh-secret-in-production'
    ) {
      throw new Error(
        '[ENV] JWT_REFRESH_SECRET must be changed from default value in production'
      );
    }
  }

  const result = envSchema.safeParse({
    ...process.env,
    APP_PORT: resolveAppPort(process.env),
  });

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `[ENV] Invalid environment variables:\n${formatted}\n\nPlease check your .env file or environment configuration.`
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}
