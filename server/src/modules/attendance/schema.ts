import { z } from 'zod';
import { CLASS_CODE_PATTERN } from '../../lib/classCode';

export const checkinSchema = z.object({
  code: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().regex(CLASS_CODE_PATTERN, 'Invalid class code format')),
  deviceId: z.string().optional(),
});

export const subjectParamsSchema = z.object({
  subjectId: z.string().uuid(),
});

export type CheckinInput = z.infer<typeof checkinSchema>;
