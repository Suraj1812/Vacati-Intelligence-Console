import { ApiError } from "@/lib/api/errors";
import { withApiRoute } from "@/lib/api/route";
import { logger } from "@/lib/observability/logger";
import { trackEvent } from "@/lib/observability/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApiRoute(request, { name: "analytics.post" }, async () => {
    const payload = (await request.json().catch(() => null)) as { name?: string; value?: unknown } | null;
    if (!payload?.name || payload.name.length > 80) {
      throw new ApiError("Invalid analytics event.", 400);
    }

    logger.info("client_analytics", {
      name: payload.name,
      value: payload.value,
    });
    trackEvent("client_analytics", payload as Record<string, unknown>);
    return Response.json({ ok: true });
  });
}
