import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number(),
});

export function healthRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Healthcheck da API',
        response: {
          200: healthResponseSchema,
        },
      },
    },
    () => {
      return {
        status: 'ok' as const,
        uptime: process.uptime(),
      };
    },
  );
}
