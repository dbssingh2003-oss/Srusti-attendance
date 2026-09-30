import { z } from 'zod';

export const createSessionSchema = z.object({
  subjectId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  windowMinutes: z.coerce.number().min(1).max(60).optional(),
});

export const extendWindowSchema = z.object({
  minutes: z.coerce.number().min(1).max(10),
});

export const sessionQuerySchema = z.object({
  subjectId: z.string().uuid().optional(),
  date: z.string().optional(),
  status: z.enum(['SCHEDULED', 'OPEN', 'CLOSED', 'FINALIZED', 'CANCELLED']).optional(),
});

export const sessionParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type ExtendWindowInput = z.infer<typeof extendWindowSchema>;
