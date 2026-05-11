# Rate Limiter using Token Bucket Algorithm

A simple in-memory rate limiter built using Node.js and Express.js.

This project uses the **Token Bucket Algorithm** to control how many requests a user can make within a time period.

---

## Features

- Token Bucket rate limiting
- Express middleware integration
- Per-IP request limiting
- Configurable capacity and refill rate
- Returns `429 Too Many Requests` when limit exceeds

---

## Tech Stack

- Node.js
- Express.js

---

## Project Structure

```text
project/
│
├── server.js
├── middleware.js
└── rateLimiter.js
