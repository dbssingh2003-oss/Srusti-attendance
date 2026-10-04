import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Resolve the path to .env in server/ or root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
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
  console.warn('⚠️ Environment variables warning (using safe fallbacks):', parsed.error.flatten().fieldErrors);
}

export const env: Env = parsed.success
  ? parsed.data
  : {
      NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      PORT: Number(process.env.PORT) || 4000,
      APP_TIMEZONE: process.env.APP_TIMEZONE || 'Asia/Kolkata',
      CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '*',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_MEAl3OgnFm1R@ep-raspy-shape-b3a0rsqn-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'srusti-attendance-production-jwt-access-secret-32chars',
      JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '15m',
      REFRESH_TTL_DAYS: Number(process.env.REFRESH_TTL_DAYS) || 7,
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || '',
      ATTENDANCE_THRESHOLD: Number(process.env.ATTENDANCE_THRESHOLD) || 50,
      DEFAULT_WINDOW_MINUTES: Number(process.env.DEFAULT_WINDOW_MINUTES) || 10,
      MAX_EXTEND_MINUTES: Number(process.env.MAX_EXTEND_MINUTES) || 10,
      MAIL_FROM: process.env.MAIL_FROM || 'no-reply@college.edu',
      SMTP_PORT: 587,
    };
export type Env = z.infer<typeof envSchema>;

