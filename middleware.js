// middleware.js

const RateLimiter = require("./rateLimiter");

// Example: 5 requests max, refill 1/sec
const limiter = new RateLimiter(5, 0.05);

function rateLimiterMiddleware(req, res, next) {
    // identify user (basic version)
    const userId = req.ip;  // can also use API key / user ID

    if (limiter.allowRequest(userId)) {
        next(); // allow request
    } else {
        res.status(429).json({
            error: "Too many requests. Please try again later."
        });
    }
}

module.exports = rateLimiterMiddleware;