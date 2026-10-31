import { config } from './config';

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export class RetryManager {
  private static defaultOptions: Required<RetryOptions> = {
    maxRetries: config.maxRetries,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    shouldRetry: (error: unknown) => {
      if (error instanceof APIError) {
        return error.retryable;
      }
      if (error instanceof Error) {
        return error.message.includes('timeout') ||
               error.message.includes('network') ||
               error.message.includes('ECONNREFUSED');
      }
      return false;
    },
  };

  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: unknown;
    let delay = opts.initialDelay;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
          throw error;
        }

        await this.delay(Math.min(delay, opts.maxDelay));
        delay *= opts.backoffMultiplier;
      }
    }

    throw lastError;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000,
    private resetTimeout: number = 30000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new APIError(
          'Circuit breaker is OPEN. Service temporarily unavailable.',
          503,
          true
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = 'CLOSED';
  }
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(
    private windowMs: number = config.rateLimitWindow,
    private maxRequests: number = config.rateLimitMax
  ) {}

  async checkLimit(key: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.requests.get(key) || [];
    const recentRequests = timestamps.filter(ts => ts > windowStart);

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(key, recentRequests);

    return true;
  }

  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter(ts => ts > windowStart);
      if (recentRequests.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recentRequests);
      }
    }
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = config.apiTimeout
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError('Request timeout', 408, true, error);
    }
    throw error;
  }
}

export function validateInput<T>(
  data: unknown,
  schema: Record<string, (value: any) => boolean>,
  errorPrefix: string = 'Validation failed'
): T {
  if (!data || typeof data !== 'object') {
    throw new APIError(`${errorPrefix}: Invalid input data`);
  }

  const errors: string[] = [];

  for (const [field, validator] of Object.entries(schema)) {
    const value = (data as Record<string, any>)[field];
    if (!validator(value)) {
      errors.push(field);
    }
  }

  if (errors.length > 0) {
    throw new APIError(
      `${errorPrefix}: Invalid fields: ${errors.join(', ')}`
    );
  }

  return data as T;
}
