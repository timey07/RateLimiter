// tests/rateLimiter.test.js
import request from "supertest";
import app from "../src/app.js";

describe("Rate Limiter Service Integration Tests (Fallback In-Memory Mode)", () => {

    it("should allow requests under the limit and set compliance headers", async () => {
        const res = await request(app)
            .get("/")
            .set("x-api-key", "free-user-test-key");

        expect(res.statusCode).toBe(200);
        expect(res.text).toContain("Hello! Request allowed");
        expect(res.headers).toHaveProperty("x-ratelimit-limit");
        expect(res.headers).toHaveProperty("x-ratelimit-remaining");
        expect(res.headers).toHaveProperty("x-ratelimit-reset");
    });

    it("should enforce rate limit and return 429 when quota is exceeded", async () => {
        const uniqueIp = `192.168.1.100`;

        // Free tier capacity is 5 requests per 10s
        for (let i = 0; i < 5; i++) {
            const res = await request(app)
                .get("/")
                .set("x-forwarded-for", uniqueIp);
            expect(res.statusCode).toBe(200);
        }

        // 6th request should hit the limit
        const blockedRes = await request(app)
            .get("/")
            .set("x-forwarded-for", uniqueIp);

        expect(blockedRes.statusCode).toBe(429);
        expect(blockedRes.body.error).toBe("Too Many Requests");
        expect(blockedRes.headers).toHaveProperty("retry-after");
    });

    it("should grant higher rate limits for premium API keys", async () => {
        const premiumKey = "api-key-premium-test";

        // Premium tier capacity is 20 requests per 10s
        for (let i = 0; i < 10; i++) {
            const res = await request(app)
                .get("/")
                .set("x-api-key", premiumKey);
            expect(res.statusCode).toBe(200);
        }

        const res11 = await request(app)
            .get("/")
            .set("x-api-key", premiumKey);
        expect(res11.statusCode).toBe(200);
    });

    it("should apply stricter limits on /heavy endpoint", async () => {
        const uniqueIp = "192.168.1.150";

        // Free tier heavy capacity is 2 requests per 10s
        const res1 = await request(app).get("/heavy").set("x-forwarded-for", uniqueIp);
        const res2 = await request(app).get("/heavy").set("x-forwarded-for", uniqueIp);
        const res3 = await request(app).get("/heavy").set("x-forwarded-for", uniqueIp);

        expect(res1.statusCode).toBe(200);
        expect(res2.statusCode).toBe(200);
        expect(res3.statusCode).toBe(429);
    });

    it("should successfully expose prometheus metrics endpoint", async () => {
        const res = await request(app).get("/metrics");
        expect(res.statusCode).toBe(200);
        expect(res.text).toContain("rate_limiter_requests_total");
        expect(res.text).toContain("rate_limiter_redis_status");
    });
});
