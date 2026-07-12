import { z } from 'zod';

export const contentStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'CANCELED',
  'FAILED',
]);

export const generateContentBodySchema = z.object({
  topic: z.string().trim().min(3).max(500),
  userId: z.uuid(),
});

export type GenerateContentBody = z.infer<typeof generateContentBodySchema>;

export const generateContentResponseSchema = z.object({
  contentId: z.uuid(),
  status: contentStatusSchema,
});
