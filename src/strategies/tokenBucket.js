// src/strategies/tokenBucket.js
import { BaseRateLimiterStrategy } from "./base.js";
import { redis, isRedisConnected } from "../config/redis.js";
import { LRUCache } from "lru-cache";
import { logger } from "../utils/logger.js";

export class TokenBucketStrategy extends BaseRateLimiterStrategy {
    constructor(options = {}) {
        super(options);
        // In-memory fallback cache to prevent downtime if Redis goes offline
        this.fallbackCache = new LRUCache({
            max: options.maxFallbackItems || 10000,
            ttl: 1000 * 60 * 60, // 1 hour default TTL
        });
    }

    async allowRequest(key, rule) {
        const { limit: capacity, windowMs } = rule;
        const windowSeconds = windowMs / 1000;
        const refillRate = capacity / windowSeconds; // tokens per second
        const nowSeconds = Date.now() / 1000;

        if (isRedisConnected()) {
            try {
                // evalTokenBucket returns [allowed, tokens]
                const result = await redis.evalTokenBucket(
                    key,
                    capacity,
                    refillRate,
                    nowSeconds,
                    1
                );

                const allowed = result[0] === 1;
                const tokens = parseFloat(result[1]);

                // Time until the bucket is completely full of tokens
                const timeToFull = (capacity - tokens) / refillRate;
                const resetTime = Math.ceil(nowSeconds + timeToFull);

                return {
                    allowed,
                    remaining: Math.floor(tokens),
                    resetTime,
                };
            } catch (err) {
                logger.error(`Redis Token Bucket failed, falling back to memory: ${err.message}`);
            }
        }

        // In-memory fallback evaluation
        let bucket = this.fallbackCache.get(key);
        if (!bucket) {
            bucket = {
                tokens: capacity,
                lastRefill: nowSeconds,
            };
        } else {
            const elapsed = Math.max(0, nowSeconds - bucket.lastRefill);
            bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillRate);
        }

        let allowed = false;
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            allowed = true;
        }

        bucket.lastRefill = nowSeconds;
        this.fallbackCache.set(key, bucket);

        const timeToFull = (capacity - bucket.tokens) / refillRate;
        const resetTime = Math.ceil(nowSeconds + timeToFull);

        return {
            allowed,
            remaining: Math.floor(bucket.tokens),
            resetTime,
        };
    }
}
