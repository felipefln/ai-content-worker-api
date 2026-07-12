import type { z } from 'zod';
import { ContentNotCancelableError } from '../errors/content-not-cancelable-error';
import { ContentNotFoundError } from '../errors/content-not-found-error';
import { InsufficientCreditsError } from '../errors/insufficient-credits-error';
import { UserNotFoundError } from '../errors/user-not-found-error';
import { prisma } from '../lib/prisma';
import { contentQueue } from '../queue/content-queue';
import { contentRepository } from '../repositories/content.repository';
import { userRepository } from '../repositories/user.repository';
import type { contentStatusSchema } from '../schemas/content.schema';

export interface GenerateContentInput {
  userId: string;
  topic: string;
}

export interface GenerateContentResult {
  contentId: string;
  status: z.infer<typeof contentStatusSchema>;
}

export const contentService = {
  async generate(input: GenerateContentInput): Promise<GenerateContentResult> {
    const content = await prisma.$transaction(async (tx) => {
      const debited = await userRepository.decrementCreditIfAvailable(input.userId, tx);

      if (!debited) {
        const user = await userRepository.findById(input.userId, tx);

        if (!user) {
          throw new UserNotFoundError(input.userId);
        }

        throw new InsufficientCreditsError(input.userId);
      }

      return contentRepository.create({ userId: input.userId, topic: input.topic }, tx);
    });

    await contentQueue.add('generate', {
      contentId: content.id,
      topic: content.topic,
    });

    return {
      contentId: content.id,
      status: content.status,
    };
  },

  async getById(contentId: string) {
    const content = await contentRepository.findById(contentId);

    if (!content) {
      throw new ContentNotFoundError(contentId);
    }

    return content;
  },

  async cancel(contentId: string) {
    const canceled = await contentRepository.cancelIfCancelable(contentId);

    if (!canceled) {
      const content = await contentRepository.findById(contentId);

      if (!content) {
        throw new ContentNotFoundError(contentId);
      }

      throw new ContentNotCancelableError(contentId, content.status);
    }

    return canceled;
  },
};
