// src/routes/metrics.js
import client from "prom-client";
import { isRedisConnected } from "../config/redis.js";

const register = new client.Registry();

// Standard system metrics (CPU, Memory, GC)
client.collectDefaultMetrics({ register });

// Rate Limiter statistics counter
const requestsCounter = new client.Counter({
    name: "rate_limiter_requests_total",
    help: "Total requests processed by the rate limiter, categorized by tier, route, and status.",
    labelNames: ["tier", "route", "status"],
});
register.registerMetric(requestsCounter);

// Redis connection status tracker
const redisStatusGauge = new client.Gauge({
    name: "rate_limiter_redis_status",
    help: "Connection health status of Redis. 1 = Online, 0 = Offline.",
});
register.registerMetric(redisStatusGauge);

export function registerMetrics(app) {
    // Save recording handler in Express app context for middleware access
    app.set("recordRateLimiterMetric", (tier, route, allowed) => {
        requestsCounter.inc({
            tier,
            route,
            status: allowed ? "allowed" : "blocked",
        });
    });

    // Scraping route for Prometheus server
    app.get("/metrics", async (req, res) => {
        try {
            // Set dynamic Redis health metric before returning payload
            redisStatusGauge.set(isRedisConnected() ? 1 : 0);

            res.setHeader("Content-Type", register.contentType);
            res.send(await register.metrics());
        } catch (err) {
            res.status(500).send(err.message);
        }
    });
}
