import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentNotCancelableError } from '../errors/content-not-cancelable-error';
import { ContentNotFoundError } from '../errors/content-not-found-error';
import { InsufficientCreditsError } from '../errors/insufficient-credits-error';
import { UserNotFoundError } from '../errors/user-not-found-error';
import { contentQueue } from '../queue/content-queue';
import { contentRepository } from '../repositories/content.repository';
import { userRepository } from '../repositories/user.repository';
import { contentService } from './content.service';

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback({})),
  },
}));

vi.mock('../queue/content-queue', () => ({
  contentQueue: { add: vi.fn().mockResolvedValue(undefined) },
  CONTENT_JOB_OPTIONS: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
}));

vi.mock('../repositories/user.repository', () => ({
  userRepository: {
    decrementCreditIfAvailable: vi.fn(),
    findById: vi.fn(),
    incrementCredit: vi.fn(),
  },
}));

vi.mock('../repositories/content.repository', () => ({
  contentRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    cancelIfCancelable: vi.fn(),
    startProcessingIfNotCanceled: vi.fn(),
    completeIfProcessing: vi.fn(),
    failIfProcessing: vi.fn(),
  },
}));

const USER_ID = 'user-1';
const CONTENT_ID = 'content-1';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('contentService.generate', () => {
  it('debita o crédito, cria o conteúdo e enfileira o job com jobId determinístico', async () => {
    vi.mocked(userRepository.decrementCreditIfAvailable).mockResolvedValue(true);
    vi.mocked(contentRepository.create).mockResolvedValue({
      id: CONTENT_ID,
      userId: USER_ID,
      topic: 'meu topico',
      status: 'PENDING',
      resultUrl: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await contentService.generate({ userId: USER_ID, topic: 'meu topico' });

    expect(result).toEqual({ contentId: CONTENT_ID, status: 'PENDING' });
    expect(contentQueue.add).toHaveBeenCalledWith(
      'generate',
      { contentId: CONTENT_ID, topic: 'meu topico' },
      expect.objectContaining({ jobId: CONTENT_ID }),
    );
  });

  it('lança InsufficientCreditsError quando o usuário existe mas não tem crédito', async () => {
    vi.mocked(userRepository.decrementCreditIfAvailable).mockResolvedValue(false);
    vi.mocked(userRepository.findById).mockResolvedValue({ id: USER_ID, credits: 0 } as never);

    await expect(contentService.generate({ userId: USER_ID, topic: 'x' })).rejects.toThrow(
      InsufficientCreditsError,
    );
    expect(contentQueue.add).not.toHaveBeenCalled();
  });

  it('lança UserNotFoundError quando o usuário não existe', async () => {
    vi.mocked(userRepository.decrementCreditIfAvailable).mockResolvedValue(false);
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(contentService.generate({ userId: USER_ID, topic: 'x' })).rejects.toThrow(
      UserNotFoundError,
    );
    expect(contentQueue.add).not.toHaveBeenCalled();
  });
});

describe('contentService.cancel', () => {
  it('retorna o conteúdo cancelado quando o status permite', async () => {
    const canceled = {
      id: CONTENT_ID,
      userId: USER_ID,
      topic: 'x',
      status: 'CANCELED',
      resultUrl: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(contentRepository.cancelIfCancelable).mockResolvedValue(canceled as never);

    const result = await contentService.cancel(CONTENT_ID);

    expect(result).toEqual(canceled);
  });

  it('lança ContentNotFoundError quando o conteúdo não existe', async () => {
    vi.mocked(contentRepository.cancelIfCancelable).mockResolvedValue(null);
    vi.mocked(contentRepository.findById).mockResolvedValue(null);

    await expect(contentService.cancel(CONTENT_ID)).rejects.toThrow(ContentNotFoundError);
  });

  it('lança ContentNotCancelableError quando o conteúdo já está em estado terminal', async () => {
    vi.mocked(contentRepository.cancelIfCancelable).mockResolvedValue(null);
    vi.mocked(contentRepository.findById).mockResolvedValue({
      id: CONTENT_ID,
      status: 'COMPLETED',
    } as never);

    await expect(contentService.cancel(CONTENT_ID)).rejects.toThrow(ContentNotCancelableError);
  });
});

describe('contentService.markAsFailed', () => {
  it('reembolsa 1 crédito quando a transição para FAILED acontece de verdade', async () => {
    vi.mocked(contentRepository.failIfProcessing).mockResolvedValue({
      id: CONTENT_ID,
      userId: USER_ID,
      status: 'FAILED',
    } as never);

    await contentService.markAsFailed(CONTENT_ID, 'deu ruim');

    expect(userRepository.incrementCredit).toHaveBeenCalledWith(USER_ID, expect.anything());
  });

  it('não reembolsa quando o conteúdo já não está mais em PROCESSING (idempotência)', async () => {
    vi.mocked(contentRepository.failIfProcessing).mockResolvedValue(null);

    await contentService.markAsFailed(CONTENT_ID, 'deu ruim');

    expect(userRepository.incrementCredit).not.toHaveBeenCalled();
  });
});
