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
        tags: ['content'],
        summary: 'Solicita a geração de um novo conteúdo',
        description:
          'Debita 1 crédito do usuário e enfileira o processamento em background. Retorna imediatamente com status PENDING.',
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
        tags: ['content'],
        summary: 'Consulta o status de um conteúdo',
        description:
          'Retorna os dados do conteúdo, incluindo status atual, URL do arquivo gerado (se concluído) e dados originais.',
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
        tags: ['content'],
        summary: 'Cancela a geração de um conteúdo',
        description:
          'Só é permitido cancelar conteúdos com status PENDING ou PROCESSING. Conteúdos já finalizados retornam 409.',
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
