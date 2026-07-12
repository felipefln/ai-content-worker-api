import { AppError } from './app-error';

export class InsufficientCreditsError extends AppError {
  constructor(userId: string) {
    super(`User ${userId} does not have enough credits`, 402);
  }
}
