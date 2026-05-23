import { SystemStatus } from "@/components/status/system-status";
import { getSystemStatus } from "@/lib/ai/status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "System Status",
  description: "Live provider, retrieval, embedding, cache, and ingestion status for Vacati Intelligence Console.",
};

export default async function StatusPage() {
  const status = await getSystemStatus();
  return <SystemStatus status={status} />;
}
