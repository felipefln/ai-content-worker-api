import type { z } from 'zod';
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
};
