import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentJobData } from '../queue/content-queue';
import { simulateAIGeneration } from '../services/ai-simulation.service';
import { contentService } from '../services/content.service';
import { uploadContentResult } from '../services/storage.service';
import { handleJobFailed, processContentJob } from './content-job-processor';

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../services/ai-simulation.service', () => ({
  simulateAIGeneration: vi.fn(),
}));

vi.mock('../services/storage.service', () => ({
  uploadContentResult: vi.fn(),
}));

vi.mock('../services/content.service', () => ({
  contentService: {
    startProcessing: vi.fn(),
    completeGeneration: vi.fn(),
    markAsFailed: vi.fn().mockResolvedValue(undefined),
  },
}));

function fakeJob(overrides: Partial<Job<ContentJobData>> = {}): Job<ContentJobData> {
  return {
    data: { contentId: 'content-1', topic: 'topico' },
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  } as Job<ContentJobData>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processContentJob', () => {
  it('processa o job normalmente quando o conteúdo pode ser processado', async () => {
    vi.mocked(contentService.startProcessing).mockResolvedValue({ id: 'content-1' } as never);
    vi.mocked(simulateAIGeneration).mockResolvedValue('texto gerado');
    vi.mocked(uploadContentResult).mockResolvedValue('http://minio/bucket/content-1.txt');
    vi.mocked(contentService.completeGeneration).mockResolvedValue({ id: 'content-1' } as never);

    await processContentJob(fakeJob());

    expect(contentService.startProcessing).toHaveBeenCalledWith('content-1');
    expect(simulateAIGeneration).toHaveBeenCalledWith('topico');
    expect(uploadContentResult).toHaveBeenCalledWith('content-1', 'texto gerado');
    expect(contentService.completeGeneration).toHaveBeenCalledWith(
      'content-1',
      'http://minio/bucket/content-1.txt',
    );
  });

  it('não processa se o conteúdo já foi cancelado antes do worker pegar o job', async () => {
    vi.mocked(contentService.startProcessing).mockResolvedValue(null);

    await processContentJob(fakeJob());

    expect(simulateAIGeneration).not.toHaveBeenCalled();
    expect(uploadContentResult).not.toHaveBeenCalled();
    expect(contentService.completeGeneration).not.toHaveBeenCalled();
  });

  it('descarta o resultado sem lançar erro se o conteúdo foi cancelado durante o processamento', async () => {
    vi.mocked(contentService.startProcessing).mockResolvedValue({ id: 'content-1' } as never);
    vi.mocked(simulateAIGeneration).mockResolvedValue('texto gerado');
    vi.mocked(uploadContentResult).mockResolvedValue('http://minio/bucket/content-1.txt');
    vi.mocked(contentService.completeGeneration).mockResolvedValue(null);

    await expect(processContentJob(fakeJob())).resolves.toBeUndefined();
  });
});

describe('handleJobFailed', () => {
  it('ignora quando o job é undefined', () => {
    handleJobFailed(undefined, new Error('falhou'));

    expect(contentService.markAsFailed).not.toHaveBeenCalled();
  });

  it('não marca como falha definitiva se ainda há tentativas restantes', () => {
    handleJobFailed(fakeJob({ attemptsMade: 1, opts: { attempts: 3 } }), new Error('falhou'));

    expect(contentService.markAsFailed).not.toHaveBeenCalled();
  });

  it('marca como falha definitiva (e reembolsa) na última tentativa', () => {
    handleJobFailed(
      fakeJob({ attemptsMade: 3, opts: { attempts: 3 } }),
      new Error('falhou de vez'),
    );

    expect(contentService.markAsFailed).toHaveBeenCalledWith('content-1', 'falhou de vez');
  });
});
