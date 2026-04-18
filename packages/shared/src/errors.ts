// @pms/shared - Error classes
export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', 400, message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', 404, message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super('FORBIDDEN', 403, message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
    this.name = 'ConflictError';
  }
}
