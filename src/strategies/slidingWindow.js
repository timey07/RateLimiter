// src/strategies/slidingWindow.js
import { BaseRateLimiterStrategy } from "./base.js";
import { redis, isRedisConnected } from "../config/redis.js";
import { LRUCache } from "lru-cache";
import { logger } from "../utils/logger.js";

export class SlidingWindowStrategy extends BaseRateLimiterStrategy {
    constructor(options = {}) {
        super(options);
        // In-memory fallback cache storing lists of request timestamps
        this.fallbackCache = new LRUCache({
            max: options.maxFallbackItems || 10000,
            ttl: 1000 * 60 * 60, // 1 hour default TTL
        });
    }

    async allowRequest(key, rule) {
        const { limit, windowMs } = rule;
        const nowMs = Date.now();
        const uniqueId = `${nowMs}-${Math.random().toString(36).substring(2, 11)}`;

        if (isRedisConnected()) {
            try {
                // evalSlidingWindow returns [allowed, remaining]
                const result = await redis.evalSlidingWindow(
                    key,
                    nowMs,
                    windowMs,
                    limit,
                    uniqueId
                );

                const allowed = result[0] === 1;
                const remaining = parseInt(result[1], 10);
                const resetTime = Math.ceil((nowMs + windowMs) / 1000);

                return {
                    allowed,
                    remaining,
                    resetTime,
                };
            } catch (err) {
                logger.error(`Redis Sliding Window failed, falling back to memory: ${err.message}`);
            }
        }

        // In-memory fallback evaluation
        let timestamps = this.fallbackCache.get(key) || [];
        const clearBefore = nowMs - windowMs;

        // Filter out timestamps outside current window
        timestamps = timestamps.filter(t => t > clearBefore);

        let allowed = false;
        let remaining = limit - timestamps.length;

        if (timestamps.length < limit) {
            timestamps.push(nowMs);
            allowed = true;
            remaining = limit - timestamps.length;
        }

        this.fallbackCache.set(key, timestamps);

        // Reset time is when the oldest timestamp within the window will slide out
        const oldestTimestamp = timestamps.length > 0 ? timestamps[0] : nowMs;
        const resetTime = Math.ceil((oldestTimestamp + windowMs) / 1000);

        return {
            allowed,
            remaining,
            resetTime,
        };
    }
}
