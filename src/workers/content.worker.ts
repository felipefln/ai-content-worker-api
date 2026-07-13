import { Worker } from 'bullmq';
import { redisConnection } from '../queue/connection';
import { CONTENT_QUEUE_NAME, type ContentJobData } from '../queue/content-queue';
import { handleJobFailed, processContentJob } from './content-job-processor';

export const contentWorker = new Worker<ContentJobData>(CONTENT_QUEUE_NAME, processContentJob, {
  connection: redisConnection,
});

contentWorker.on('failed', handleJobFailed);
