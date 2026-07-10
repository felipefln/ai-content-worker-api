import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../../errors/app-error';

function isClientError(statusCode: number): boolean {
  return statusCode >= 400 && statusCode < 500;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        message: 'Validation error',
        issues: error.issues,
      });
      return;
    }

    if (error instanceof AppError) {
      reply.status(error.statusCode).send({ message: error.message });
      return;
    }

    if (typeof error.statusCode === 'number' && isClientError(error.statusCode)) {
      reply.status(error.statusCode).send({ message: error.message });
      return;
    }

    request.log.error(error);
    reply.status(500).send({ message: 'Internal Server Error' });
  });
}
