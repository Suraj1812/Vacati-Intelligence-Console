"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, CircleAlert, Cpu, Database, Gauge, KeyRound, RadioTower, Timer } from "lucide-react";

import type { SystemStatus as SystemStatusType } from "@/lib/ai/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function SystemStatus({ status }: { status: SystemStatusType }) {
  return (
    <main className="min-h-screen bg-[#070807] text-zinc-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(111,94,70,0.18),transparent_58%)]" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" className="rounded-md text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Console
            </Link>
          </Button>
          <Badge className="rounded-md border border-emerald-200/15 bg-emerald-200/10 text-emerald-50 hover:bg-emerald-200/10">
            {status.health.api === "healthy" ? "Healthy" : "Needs setup"}
          </Badge>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="my-auto py-12"
        >
          <p className="text-sm text-zinc-500">AI System Status</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-zinc-50 sm:text-6xl">
            Grounding, generation, and retrieval health at a glance.
          </h1>

          <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-7">
              <StatusLine icon={RadioTower} label="Active provider" value={status.provider} />
              <StatusLine icon={Cpu} label="Model" value={status.model} />
              <StatusLine icon={KeyRound} label="Fallback" value={status.fallbackProvider} />
              <StatusLine icon={Database} label="Vector database" value={status.vectorDatabase} />
              <StatusLine
                icon={Gauge}
                label="Embeddings"
                value={`${status.embeddingProvider} / ${status.embeddingModel}`}
              />
            </div>

            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-3">
                <Metric label="Prompt" value={status.tokenUsage.prompt.toLocaleString()} unit="tokens" />
                <Metric label="Completion" value={status.tokenUsage.completion.toLocaleString()} unit="tokens" />
                <Metric label="Embedding" value={status.tokenUsage.embedding.toLocaleString()} unit="tokens" />
              </div>

              <Separator className="bg-white/10" />

              <div className="grid gap-4 sm:grid-cols-3">
                <Health label="API" value={status.health.api} />
                <Health label="Embeddings" value={status.health.embeddings} />
                <Health label="Grounding" value={status.health.grounding} />
              </div>

              <Separator className="bg-white/10" />

              <div className="grid gap-3 sm:grid-cols-2">
                {status.providerHealth.map((provider) => (
                  <div key={provider.provider} className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                    <p className="flex items-center justify-between gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-2">
                        {provider.healthy ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                        ) : (
                          <CircleAlert className="h-3.5 w-3.5 text-amber-200" />
                        )}
                        {provider.provider}
                      </span>
                      <span className="font-mono text-zinc-400">{provider.latencyMs} ms</span>
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{provider.message}</p>
                  </div>
                ))}
              </div>

              <Separator className="bg-white/10" />

              <div className="space-y-4">
                <Latency label="Retrieval" value={status.latency.retrievalMs} />
                <Latency label="Generation" value={status.latency.generationMs} />
                <Latency label="Total" value={status.latency.totalMs} />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Metric label="Cache hits" value={status.cache.hits.toLocaleString()} unit="responses" />
                <Metric label="Provider errors" value={status.errors.provider.toLocaleString()} unit="fallbacks" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function StatusLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-white/[0.08] pb-4">
      <div className="flex items-center gap-3 text-zinc-500">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <span className="max-w-[52%] truncate text-right font-mono text-sm text-zinc-200">{value}</span>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-3xl text-zinc-50">{value}</p>
      <p className="mt-1 text-xs text-zinc-600">{unit}</p>
    </div>
  );
}

function Health({ label, value }: { label: string; value: string }) {
  const healthy = value === "healthy";
  return (
    <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        {healthy ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <CircleAlert className="h-3.5 w-3.5 text-amber-200" />}
        {label}
      </p>
      <p className="mt-2 font-mono text-sm text-zinc-200">{value}</p>
    </div>
  );
}

function Latency({ label, value }: { label: string; value: number }) {
  const width = Math.min(100, Math.max(8, value / 12));

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-2">
          <Timer className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="font-mono text-zinc-300">{value} ms</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-amber-200" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
