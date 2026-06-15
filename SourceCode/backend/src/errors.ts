import type { ErrorCode, SldAgentErrorDetails } from './shared/types.js';

export class SldAgentError extends Error {
  public readonly code: ErrorCode;
  public readonly details: SldAgentErrorDetails;

  constructor(code: ErrorCode, message: string, details: SldAgentErrorDetails = {}) {
    super(message);
    this.name = 'SldAgentError';
    this.code = code;
    this.details = details;
  }
}

export function isSldAgentError(err: unknown): err is SldAgentError {
  return err instanceof SldAgentError;
}

export class BuilderError extends Error {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'BuilderError';
    this.field = field;
  }
}
