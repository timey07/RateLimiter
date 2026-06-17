-- Token Bucket Lua Script
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2]) -- tokens per second
local now = tonumber(ARGV[3])        -- current time in seconds (can be decimal)
local requested = tonumber(ARGV[4] or 1)

local data = redis.call("HMGET", key, "tokens", "lastRefill")
local tokens = tonumber(data[1])
local lastRefill = tonumber(data[2])

if not tokens then
    tokens = capacity
    lastRefill = now
else
    local elapsed = math.max(0, now - lastRefill)
    tokens = math.min(capacity, tokens + elapsed * refillRate)
end

local allowed = 0
if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
end

redis.call("HMSET", key, "tokens", tokens, "lastRefill", now)

-- Expose TTL to clear unused buckets
local ttl = math.ceil(capacity / refillRate) * 2
if ttl < 3600 then
    ttl = 3600
end
redis.call("EXPIRE", key, ttl)

return { allowed, tokens }
