import { env } from '../config/env';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function simulateAIGeneration(topic: string): Promise<string> {
  await delay(env.AI_SIMULATION_DELAY_MS);

  if (Math.random() < env.AI_SIMULATION_FAILURE_RATE) {
    throw new Error(`AI simulation failed while generating content for topic "${topic}"`);
  }

  return [
    `Conteúdo gerado automaticamente sobre "${topic}".`,
    '',
    `Este é um texto fictício produzido pela simulação de IA do desafio técnico, demonstrando o fluxo completo de geração assíncrona: da fila de processamento até o armazenamento do resultado final.`,
  ].join('\n');
}
