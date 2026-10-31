import { z } from 'zod';

const booleanFromEnv = z.enum(['true', 'false']).optional().transform(value => value === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  ALLOWED_ORIGINS: z.string().optional(),
  PGSSL: booleanFromEnv,
  TRUST_PROXY: booleanFromEnv,
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().trim().min(1).default('EmployeeMS'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().regex(/^[a-zA-Z0-9._-]+$/).default('gemini-2.5-flash-lite')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid server environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Server environment configuration is invalid');
}

export const config = parsed.data;
export const allowedOrigins = new Set((config.ALLOWED_ORIGINS || config.CLIENT_URL).split(',').map(origin => origin.trim()).filter(Boolean));
