import { AppError } from './app-error';

export class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super(`User ${userId} not found`, 404);
  }
}
