import { getErrorMessage } from "./helpers.js";

class GeotabRateLimiter {
  constructor(maxRequestsPerMinute = 60, maxConcurrency = 10) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.maxConcurrency = maxConcurrency;
    this.tokens = maxRequestsPerMinute;
    this.lastRefill = Date.now();
    this.queue = [];
    this.activeCount = 0;
    this.inFlight = new Map();
  }

  refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 60000) * this.maxRequestsPerMinute;
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxRequestsPerMinute, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  async acquireToken() {
    return new Promise(resolve => {
      const tryAcquire = () => {
        this.refill();
        if (this.tokens >= 1 && this.activeCount < this.maxConcurrency) {
          this.tokens -= 1;
          this.activeCount += 1;
          resolve();
        } else {
          // Wait a bit and try again. 
          // If out of tokens, we wait based on rate. If out of concurrency, we just poll.
          const delay = (this.tokens < 1) ? (60000 / this.maxRequestsPerMinute) : 50;
          setTimeout(tryAcquire, delay);
        }
      };
      tryAcquire();
    });
  }

  releaseToken() {
    this.activeCount -= 1;
    this.processQueue();
  }

  processQueue() {
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrency) {
      const next = this.queue.shift();
      next();
    }
  }

  generateCacheKey(organizationId, credentials, requestBody) {
    // Exclude credentials from key to avoid exposing them, use username+db instead
    const credString = credentials ? `${credentials.database || credentials.database}:${credentials.userName || credentials.username}` : 'anon';
    return `${organizationId}:${credString}:${JSON.stringify(requestBody)}`;
  }

  async execute(organizationId, credentials, requestBody, apiCallFunction, maxRetries = 3) {
    const key = this.generateCacheKey(organizationId, credentials, requestBody);

    if (this.inFlight.has(key)) {
      console.log(`[Geotab Limiter] Deduplicating identical in-flight request: ${requestBody.method}`);
      return this.inFlight.get(key);
    }

    const promise = this._executeWithRetry(organizationId, credentials, requestBody, apiCallFunction, maxRetries, key)
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  async _executeWithRetry(organizationId, credentials, requestBody, apiCallFunction, maxRetries, key, attempt = 1) {
    // Wait in queue if necessary
    await new Promise(resolve => {
      this.queue.push(resolve);
      this.processQueue();
    });

    await this.acquireToken();
    const startTime = Date.now();

    try {
      const result = await apiCallFunction(organizationId, credentials, requestBody);
      const execTime = Date.now() - startTime;
      console.log(`[Geotab Limiter] Success | Method: ${requestBody.method} | Org: ${organizationId} | Time: ${execTime}ms`);
      return result;
    } catch (error) {
      const execTime = Date.now() - startTime;
      const message = getErrorMessage(error);
      
      const isRateLimit = message.toLowerCase().includes('quota') || message.includes('429');
      const isRetryable = isRateLimit || message.includes('timeout') || message.includes('502') || message.includes('503') || message.includes('ECONNRESET');

      if (isRetryable && attempt <= maxRetries) {
        // Exponential backoff with jitter
        let delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        
        // Respect Retry-After if provided (extracting naively if it's in the error string or response)
        if (error.response && error.response.headers && error.response.headers['retry-after']) {
           const retryAfter = parseInt(error.response.headers['retry-after'], 10);
           if (!isNaN(retryAfter)) delay = retryAfter * 1000;
        } else if (isRateLimit) {
           delay = Math.max(delay, 5000); // At least 5s for rate limits
        }
        
        console.warn(`[Geotab Limiter] Retryable Error (${message}). Attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(delay)}ms...`);
        
        await new Promise(r => setTimeout(r, delay));
        return this._executeWithRetry(organizationId, credentials, requestBody, apiCallFunction, maxRetries, key, attempt + 1);
      }
      
      console.error(`[Geotab Limiter] Failed permanently after ${attempt} attempts | Method: ${requestBody.method} | Org: ${organizationId} | Error: ${message}`);
      throw error;
    } finally {
      this.releaseToken();
    }
  }
}

export const geotabLimiter = new GeotabRateLimiter(60, 10);
