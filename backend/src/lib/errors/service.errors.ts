import { BaseError } from './base.error.js';

export class SecretAIUnauthorizedError extends BaseError {
  constructor(message: string) {
    super(`${message}`);
  }
}

export class SecretAIModelError extends BaseError {
  constructor(message: string) {
    super(`${message}`);
  }
}

export class DeepSeekUnauthorizedError extends BaseError {
  constructor(message: string) {
    super(`${message}`);
  }
}

export class DeepSeekModelError extends BaseError {
  constructor(message: string) {
    super(`${message}`);
  }
}

export class InputError extends BaseError {
  constructor(message: string) {
    super(`${message}`);
  }
}
