import { ApiError } from "@/lib/api/errors";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return buildRateLimitHeaders(limit, limit - 1, now + windowMs);
  }

  if (current.count >= limit) {
    const error = new ApiError("Too many requests. Please slow down and try again shortly.", 429);
    error.headers = buildRateLimitHeaders(limit, 0, current.resetAt);
    throw error;
  }

  current.count += 1;
  return buildRateLimitHeaders(limit, Math.max(0, limit - current.count), current.resetAt);
}

export function clientKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.slice(0, 80) ?? "unknown-agent";
  return `${scope}:${forwardedFor ?? realIp ?? "local"}:${userAgent}`;
}

function buildRateLimitHeaders(limit: number, remaining: number, resetAt: number) {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}
