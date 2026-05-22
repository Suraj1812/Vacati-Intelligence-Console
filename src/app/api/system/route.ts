import { getSystemStatus } from "@/lib/ai/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getSystemStatus());
}
