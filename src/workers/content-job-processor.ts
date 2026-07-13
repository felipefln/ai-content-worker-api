import type { Job } from 'bullmq';
import { logger } from '../lib/logger';
import type { ContentJobData } from '../queue/content-queue';
import { simulateAIGeneration } from '../services/ai-simulation.service';
import { contentService } from '../services/content.service';
import { uploadContentResult } from '../services/storage.service';

export async function processContentJob(job: Job<ContentJobData>): Promise<void> {
  const { contentId, topic } = job.data;

  logger.info({ contentId, attempt: job.attemptsMade + 1 }, 'Processing content job');

  const started = await contentService.startProcessing(contentId);

  if (!started) {
    logger.info({ contentId }, 'Content already canceled, skipping processing');
    return;
  }

  const text = await simulateAIGeneration(topic);
  const resultUrl = await uploadContentResult(contentId, text);

  const completed = await contentService.completeGeneration(contentId, resultUrl);

  if (!completed) {
    logger.info({ contentId }, 'Content canceled during processing, discarding result');
    return;
  }

  logger.info({ contentId, resultUrl }, 'Content generation completed');
}

export function handleJobFailed(job: Job<ContentJobData> | undefined, error: Error): void {
  if (!job) {
    return;
  }

  const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);

  logger.warn(
    {
      contentId: job.data.contentId,
      attempt: job.attemptsMade,
      isFinalAttempt,
      error: error.message,
    },
    'Content job attempt failed',
  );

  if (!isFinalAttempt) {
    return;
  }

  contentService.markAsFailed(job.data.contentId, error.message).catch((refundError: unknown) => {
    logger.error(
      { contentId: job.data.contentId, err: refundError },
      'Failed to mark content as failed',
    );
  });
}
