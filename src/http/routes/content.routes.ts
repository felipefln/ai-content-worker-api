import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  contentParamsSchema,
  contentResponseSchema,
  generateContentBodySchema,
  generateContentResponseSchema,
} from '../../schemas/content.schema';
import { contentService } from '../../services/content.service';

export function contentRoutes(app: FastifyInstance): void {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/api/content/generate',
    {
      schema: {
        body: generateContentBodySchema,
        response: {
          201: generateContentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await contentService.generate(request.body);
      return reply.status(201).send(result);
    },
  );

  typedApp.get(
    '/api/content/:id',
    {
      schema: {
        params: contentParamsSchema,
        response: {
          200: contentResponseSchema,
        },
      },
    },
    async (request) => {
      return contentService.getById(request.params.id);
    },
  );

  typedApp.post(
    '/api/content/:id/cancel',
    {
      schema: {
        params: contentParamsSchema,
        response: {
          200: contentResponseSchema,
        },
      },
    },
    async (request) => {
      return contentService.cancel(request.params.id);
    },
  );
}
