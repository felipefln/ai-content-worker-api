import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { env } from './config/env';
import { registerErrorHandler } from './http/plugins/error-handler';
import { contentRoutes } from './http/routes/content.routes';
import { healthRoutes } from './http/routes/health';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  registerErrorHandler(app);
  await app.register(healthRoutes);
  await app.register(contentRoutes);

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
