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

export const contentParamsSchema = z.object({
  id: z.uuid(),
});

export type ContentParams = z.infer<typeof contentParamsSchema>;

export const contentResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  topic: z.string(),
  status: contentStatusSchema,
  resultUrl: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
