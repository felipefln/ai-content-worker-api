import { AppError } from './app-error';

export class ContentNotFoundError extends AppError {
  constructor(contentId: string) {
    super(`Content ${contentId} not found`, 404);
  }
}
