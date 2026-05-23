import { getSystemStatus } from "@/lib/ai/status";
import { withApiRoute } from "@/lib/api/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApiRoute(request, { name: "system.get" }, async () => Response.json(await getSystemStatus()));
}
