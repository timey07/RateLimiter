-- Sliding Window Lua Script
local key = KEYS[1]
local now = tonumber(ARGV[1])      -- current time in ms
local window = tonumber(ARGV[2])   -- window size in ms
local limit = tonumber(ARGV[3])    -- max requests allowed in window
local memberId = ARGV[4]           -- unique request identifier

local clearBefore = now - window

-- Remove elements outside the window
redis.call("ZREMRANGEBYSCORE", key, 0, clearBefore)

-- Count current requests in window
local currentRequests = redis.call("ZCARD", key)

local allowed = 0
if currentRequests < limit then
    redis.call("ZADD", key, now, memberId)
    allowed = 1
    currentRequests = currentRequests + 1
end

-- Expose TTL to clear unused sliding windows
local ttlSeconds = math.ceil(window / 1000) * 2
if ttlSeconds < 3600 then
    ttlSeconds = 3600
end
redis.call("EXPIRE", key, ttlSeconds)

local remaining = limit - currentRequests
return { allowed, remaining }
