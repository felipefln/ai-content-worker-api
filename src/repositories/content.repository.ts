import { Prisma } from '../generated/prisma/client';
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

  async cancelIfCancelable(id: string, db: Db = prisma) {
    try {
      return await db.content.update({
        where: { id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'CANCELED' },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }

      throw error;
    }
  },
};
