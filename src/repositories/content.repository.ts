import type { Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

type Db = typeof prisma | Prisma.TransactionClient;

export const contentRepository = {
  async create(data: { userId: string; topic: string }, db: Db = prisma) {
    return db.content.create({
      data: {
        userId: data.userId,
        topic: data.topic,
      },
    });
  },

  async findById(id: string, db: Db = prisma) {
    return db.content.findUnique({ where: { id } });
  },
};
