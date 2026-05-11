// rateLimiter.js

class RateLimiter {
    constructor(capacity, refillRate) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.buckets = new Map(); // userId -> { tokens, lastRefill }
    }

    allowRequest(userId) {
        const now = Date.now() / 1000; // seconds

        if (!this.buckets.has(userId)) {
            this.buckets.set(userId, {
                tokens: this.capacity,
                lastRefill: now
            });
        }

        const bucket = this.buckets.get(userId);

        const elapsed = now - bucket.lastRefill;

        // refill tokens
        bucket.tokens += elapsed * this.refillRate;
        bucket.tokens = Math.min(bucket.tokens, this.capacity);

        bucket.lastRefill = now;

        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            return true;
        }

        return false;
    }
}

module.exports = RateLimiter;