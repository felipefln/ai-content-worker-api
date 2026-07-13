import { Queue } from 'bullmq';
import { redisConnection } from './connection';

export const CONTENT_QUEUE_NAME = 'content-generation';

export interface ContentJobData {
  contentId: string;
  topic: string;
}

export const CONTENT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
} as const;

export const contentQueue = new Queue<ContentJobData>(CONTENT_QUEUE_NAME, {
  connection: redisConnection,
});
