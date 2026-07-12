import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
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
}
