import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

type Db = typeof prisma | Prisma.TransactionClient;

export const userRepository = {
  async findById(id: string, db: Db = prisma) {
    return db.user.findUnique({ where: { id } });
  },

  async decrementCreditIfAvailable(id: string, db: Db = prisma): Promise<boolean> {
    const result = await db.user.updateMany({
      where: { id, credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });

    return result.count > 0;
  },
};
