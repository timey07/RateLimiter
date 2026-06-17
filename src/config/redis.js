// src/config/redis.js
import Redis from "ioredis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = parseInt(process.env.REDIS_PORT || "6379", 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || null;

let redisClient = null;
let redisConnected = false;

export function initRedis() {
    if (process.env.NODE_ENV === "test") {
        logger.info("Test environment detected. Skipping Redis initialization.");
        redisClient = {
            evalTokenBucket: async () => [0, 0],
            evalSlidingWindow: async () => [0, 0],
            quit: async () => {},
        };
        redisConnected = false;
        return redisClient;
    }

    if (redisClient) return redisClient;

    const config = {
        host: REDIS_HOST,
        port: REDIS_PORT,
        retryStrategy(times) {
            // Reconnect after an increasing delay, max 3 seconds
            const delay = Math.min(times * 100, 3000);
            return delay;
        },
        maxRetriesPerRequest: 1, // Fail fast to trigger in-memory fallback quickly
    };

    if (REDIS_PASSWORD) {
        config.password = REDIS_PASSWORD;
    }

    redisClient = new Redis(config);

    redisClient.on("connect", () => {
        redisConnected = true;
        logger.info("Connected to Redis successfully.");
    });

    redisClient.on("error", (err) => {
        redisConnected = false;
        logger.error(`Redis Error: ${err.message}`);
    });

    redisClient.on("close", () => {
        redisConnected = false;
        logger.warn("Redis connection closed.");
    });

    // Register Lua Scripts as Redis Commands
    try {
        const tokenBucketLuaPath = path.join(__dirname, "../scripts/tokenBucket.lua");
        const tokenBucketLua = fs.readFileSync(tokenBucketLuaPath, "utf8");
        redisClient.defineCommand("evalTokenBucket", {
            numberOfKeys: 1,
            lua: tokenBucketLua,
        });

        const slidingWindowLuaPath = path.join(__dirname, "../scripts/slidingWindow.lua");
        const slidingWindowLua = fs.readFileSync(slidingWindowLuaPath, "utf8");
        redisClient.defineCommand("evalSlidingWindow", {
            numberOfKeys: 1,
            lua: slidingWindowLua,
        });

        logger.info("Redis Lua scripts registered successfully.");
    } catch (err) {
        logger.error(`Failed to register Redis Lua scripts: ${err.message}`);
    }

    return redisClient;
}

export function isRedisConnected() {
    return redisConnected;
}

// Automatically initialize redis client
initRedis();

export { redisClient as redis };
