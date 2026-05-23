import { errorResponse } from "@/lib/api/errors";
import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";
import { trackEvent } from "@/lib/observability/events";
import { checkRateLimit, clientKey } from "@/lib/security/rate-limit";

type RouteOptions = {
  name: string;
  rateLimit?: {
    scope: string;
    limit: number;
  };
};

export async function withApiRoute(
  request: Request,
  options: RouteOptions,
  handler: () => Promise<Response>,
) {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  const env = getEnv();
  let rateLimitHeaders: Record<string, string> = {};

  try {
    if (options.rateLimit) {
      rateLimitHeaders = checkRateLimit({
        key: clientKey(request, options.rateLimit.scope),
        limit: options.rateLimit.limit,
        windowMs: env.rateLimitWindowSeconds * 1000,
      });
    }

    const response = await handler();
    const durationMs = Math.round(performance.now() - startedAt);
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", requestId);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => headers.set(key, value));

    logger.info("api_request", {
      requestId,
      route: options.name,
      method: request.method,
      status: response.status,
      durationMs,
    });
    trackEvent("api_request", {
      route: options.name,
      method: request.method,
      status: response.status,
      durationMs,
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    logger.error("api_error", {
      requestId,
      route: options.name,
      method: request.method,
      durationMs,
      error: error instanceof Error ? error.message : "unknown",
    });
    trackEvent("api_error", {
      route: options.name,
      method: request.method,
      durationMs,
      error: error instanceof Error ? error.message : "unknown",
    });
    const response = errorResponse(error);
    response.headers.set("X-Request-Id", requestId);
    return response;
  }
}
