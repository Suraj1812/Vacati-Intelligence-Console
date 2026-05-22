import { getSystemStatus } from "@/lib/ai/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getSystemStatus();
  const healthy = status.health.api !== "degraded";

  return Response.json(
    {
      ok: healthy,
      service: "vacati-intelligence-console",
      provider: status.activeProviderId,
      vectorDatabase: status.vectorDatabase,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
