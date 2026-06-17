// src/middleware/rateLimiter.js
import { TokenBucketStrategy } from "../strategies/tokenBucket.js";
import { SlidingWindowStrategy } from "../strategies/slidingWindow.js";
import { logger } from "../utils/logger.js";

// Define Tier Configurations
const TIERS = {
    free: {
        global: { limit: 5, windowMs: 10000 },  // 5 requests / 10s
        heavy: { limit: 2, windowMs: 10000 },   // 2 requests / 10s
    },
    premium: {
        global: { limit: 20, windowMs: 10000 }, // 20 requests / 10s
        heavy: { limit: 10, windowMs: 10000 },  // 10 requests / 10s
    },
};

const STRATEGIES = {
    tokenBucket: new TokenBucketStrategy(),
    slidingWindow: new SlidingWindowStrategy(),
};

const DEFAULT_STRATEGY = process.env.RATE_LIMIT_STRATEGY || "tokenBucket";

export function createRateLimiterMiddleware(options = {}) {
    const strategyName = options.strategy || DEFAULT_STRATEGY;
    const strategy = STRATEGIES[strategyName] || STRATEGIES.tokenBucket;

    logger.info(`Rate limiter middleware active. Strategy: ${strategyName}`);

    return async (req, res, next) => {
        try {
            // 1. Client Identification (API Key first, fallback to IP)
            const apiKey = req.headers["x-api-key"];
            // Clean IP address if it contains IPv6 prefix (e.g. ::ffff:)
            let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip;
            if (ip && ip.startsWith("::ffff:")) {
                ip = ip.substring(7);
            }
            const clientId = apiKey ? `apikey:${apiKey}` : `ip:${ip}`;

            // 2. Resolve User Tier
            // Logic: API Key containing 'premium' or custom header 'x-user-tier' set to premium
            let tier = "free";
            if (apiKey && apiKey.toLowerCase().includes("premium")) {
                tier = "premium";
            } else if (req.headers["x-user-tier"]) {
                const headerTier = req.headers["x-user-tier"].toLowerCase();
                if (TIERS[headerTier]) {
                    tier = headerTier;
                }
            }

            // 3. Resolve Route Specific Rule
            const path = req.path;
            const tierConfig = TIERS[tier];
            let rule = tierConfig.global;
            let routeCategory = "global";

            if (path.startsWith("/heavy")) {
                rule = tierConfig.heavy;
                routeCategory = "heavy";
            }

            // 4. Construct Rate Limiter Key
            const limitKey = `ratelimit:${tier}:${routeCategory}:${clientId}`;

            // 5. Evaluate Request
            const result = await strategy.allowRequest(limitKey, rule);

            // 6. Set Standard HTTP Headers
            res.setHeader("X-RateLimit-Limit", rule.limit);
            res.setHeader("X-RateLimit-Remaining", result.remaining);
            res.setHeader("X-RateLimit-Reset", result.resetTime);

            // 7. Track Metrics (if metrics registry registered in app)
            const recordMetrics = req.app.get("recordRateLimiterMetric");
            if (typeof recordMetrics === "function") {
                recordMetrics(tier, routeCategory, result.allowed);
            }

            if (result.allowed) {
                next();
            } else {
                const nowSeconds = Math.ceil(Date.now() / 1000);
                const retryAfter = Math.max(1, result.resetTime - nowSeconds);
                res.setHeader("Retry-After", retryAfter);

                logger.warn(`Rate Limit Exceeded for Key: ${limitKey}. Remaining: ${result.remaining}`);
                res.status(429).json({
                    error: "Too Many Requests",
                    message: "Rate limit exceeded. Please try again later.",
                    tier,
                    routeCategory,
                    limit: rule.limit,
                    retryAfterSeconds: retryAfter,
                });
            }
        } catch (err) {
            logger.error(`Rate limiting middleware crash: ${err.message}`);
            // Fail-open: Let request pass rather than crashing server in production
            next();
        }
    };
}
