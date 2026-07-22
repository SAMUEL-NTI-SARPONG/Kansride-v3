import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  APP_PORT: z.coerce.number().int().positive().default(3001),

  // Database (PostgreSQL + PostGIS)
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().default('kansride'),
  DATABASE_USER: z.string().default('postgres'),
  DATABASE_PASSWORD: z.string().default('postgres'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5432/kansride'),

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

  // SMS Provider
  SMS_PROVIDER: z.enum(['mock', 'hubtel', 'arkesel']).default('mock'),
  SMS_API_KEY: z.string().default(''),
  SMS_API_SECRET: z.string().default(''),

  // Maps
  MAPS_PROVIDER: z.enum(['openstreetmap', 'google']).default('openstreetmap'),
  MAPS_API_KEY: z.string().default(''),

  // Logging
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('debug'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Parses and validates environment variables against the schema.
 * Uses sensible defaults for development but fails fast in production
 * if required variables are missing.
 */
export function getEnv(): Env {
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
      'DATABASE_PASSWORD',
    ] as const;

    const missing = requiredInProduction.filter(
      (key) => !process.env[key] || process.env[key] === ''
    );

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

  const result = envSchema.safeParse(process.env);

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
