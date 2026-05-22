import { SystemStatus } from "@/components/status/system-status";
import { getSystemStatus } from "@/lib/ai/status";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const status = await getSystemStatus();
  return <SystemStatus status={status} />;
}
