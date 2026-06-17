// src/strategies/base.js

export class BaseRateLimiterStrategy {
    constructor(options = {}) {
        this.options = options;
    }

    /**
     * Evaluates if a client request should be allowed.
     * @param {string} key - Unique rate limiting key (e.g. ratelimit:ip:route)
     * @param {object} rule - Limit rules (e.g. { limit, windowMs, capacity, refillRate })
     * @returns {Promise<{ allowed: boolean, remaining: number, resetTime: number }>}
     */
    async allowRequest(key, rule) {
        throw new Error("Method 'allowRequest' must be implemented.");
    }
}
