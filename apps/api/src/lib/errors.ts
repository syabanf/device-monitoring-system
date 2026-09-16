import type { Problem } from '@monitoring/contracts';

/** Every expected failure is an AppError. Anything else becomes a 500 with no detail leaked. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (what: string, id: string | number) => new AppError('NOT_FOUND', 404, `${what} not found`, `No ${what} with id ${id}`);
export const forbidden = (detail: string) => new AppError('FORBIDDEN', 403, 'Forbidden', detail);
export const unauthorized = (detail: string) => new AppError('UNAUTHORIZED', 401, 'Unauthorized', detail);
export const conflict = (code: string, detail: string) => new AppError(code, 409, 'Conflict', detail);
export const badRequest = (code: string, detail: string) => new AppError(code, 400, 'Bad request', detail);

export function toProblem(err: AppError): Problem {
  return { type: `https://docs.monitoring.wit.id/errors/${err.code.toLowerCase()}`, title: err.message, status: err.status, detail: err.detail, code: err.code };
}
