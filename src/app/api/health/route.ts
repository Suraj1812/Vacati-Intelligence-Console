import { getSystemStatus } from "@/lib/ai/status";
import { withApiRoute } from "@/lib/api/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiRoute(request, { name: "health.get" }, handleGet);
}

async function handleGet() {
  const status = await getSystemStatus();
  const healthy = status.health.api !== "degraded";

  return Response.json(
    {
      ok: healthy,
      service: "vacati-intelligence-console",
      provider: status.activeProviderId,
      vectorDatabase: status.vectorDatabase,
      health: status.health,
      ingestion: status.ingestion,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
