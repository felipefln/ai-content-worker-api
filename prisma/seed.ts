import { prisma } from '../src/lib/prisma';

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: 'user-teste@ai-content-worker.dev' },
    update: {},
    create: {
      name: 'Usuário Teste',
      email: 'user-teste@ai-content-worker.dev',
      credits: 10,
    },
  });

  console.log(user);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
