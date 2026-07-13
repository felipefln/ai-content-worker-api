import { logger } from './lib/logger';
import { contentWorker } from './workers/content.worker';

contentWorker.on('ready', () => {
  logger.info('Content worker ready');
});

process.on('SIGTERM', () => {
  contentWorker
    .close()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error(error, 'Error while closing content worker');
      process.exit(1);
    });
});
