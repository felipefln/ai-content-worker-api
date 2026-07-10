import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { env } from './config/env';
import { registerErrorHandler } from './http/plugins/error-handler';
import { healthRoutes } from './http/routes/health';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  await app.register(sensible);
  registerErrorHandler(app);
  await app.register(healthRoutes);

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
