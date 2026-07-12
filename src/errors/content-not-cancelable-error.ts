import { AppError } from './app-error';

export class ContentNotCancelableError extends AppError {
  constructor(contentId: string, currentStatus: string) {
    super(`Content ${contentId} cannot be canceled from status ${currentStatus}`, 409);
  }
}
