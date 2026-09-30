import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().default('postgresql://neondb_owner:npg_MEAl3OgnFm1R@ep-raspy-shape-b3a0rsqn-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16).default('srusti-attendance-production-jwt-access-secret-32chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().default(7),
  COOKIE_DOMAIN: z.string().default(''),

  ATTENDANCE_THRESHOLD: z.coerce.number().min(0).max(100).default(50),
  DEFAULT_WINDOW_MINUTES: z.coerce.number().default(10),
  MAX_EXTEND_MINUTES: z.coerce.number().default(10),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('no-reply@college.edu'),

  SENTRY_DSN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
