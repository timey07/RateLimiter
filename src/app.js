// src/app.js
import express from "express";
import dotenv from "dotenv";
import { createRateLimiterMiddleware } from "./middleware/rateLimiter.js";
import { registerMetrics } from "./routes/metrics.js";

// Load configuration
dotenv.config();

const app = express();

app.use(express.json());

// Register metrics scraping route before applying global rate limiting middleware
// This prevents Prometheus scrapes from being blocked or consuming request quotas
registerMetrics(app);

// Apply rate limiting middleware globally
app.use(createRateLimiterMiddleware());

// Routes
app.get("/", (req, res) => {
    res.send("Hello! Request allowed ✅");
});

app.get("/heavy", (req, res) => {
    res.send("Heavy endpoint accessed 🚀");
});

app.get("/api/me", (req, res) => {
    res.json({
        ip: req.ip,
        headers: req.headers,
    });
});

export default app;
