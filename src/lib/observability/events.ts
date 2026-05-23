import { getEnv } from "@/lib/config/env";
import { logger } from "@/lib/observability/logger";

type EventPayload = Record<string, unknown>;

export function trackEvent(name: string, payload: EventPayload = {}) {
  const env = getEnv();
  if (!env.observabilityWebhookUrl) {
    return;
  }

  const body = JSON.stringify({
    name,
    service: "vacati-intelligence-console",
    timestamp: new Date().toISOString(),
    ...payload,
  });

  void fetch(env.observabilityWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch((error) => {
    logger.debug("Observability webhook failed", {
      event: name,
      error: error instanceof Error ? error.message : "unknown",
    });
  });
}
