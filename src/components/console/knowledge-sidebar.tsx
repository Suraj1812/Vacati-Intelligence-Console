"use client";

import { Activity, CheckCircle2, Database, FileText, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";

import type { KnowledgeState } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

type KnowledgeSidebarProps = {
  knowledge: KnowledgeState | null;
  isUploading: boolean;
  onUploadClick: () => void;
};

export function KnowledgeSidebar({
  knowledge,
  isUploading,
  onUploadClick,
}: KnowledgeSidebarProps) {
  const documents = knowledge?.documents ?? [];
  const hitCount = knowledge?.retrievalHits.length ?? 0;

  return (
    <aside className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Sources</p>
            <p className="mt-2 text-sm text-zinc-200">{documents.length} indexed</p>
          </div>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 rounded-md border border-white/10 bg-[#1a1b18] text-zinc-200 hover:bg-[#22231f]"
            onClick={onUploadClick}
            disabled={isUploading}
            aria-label="Upload knowledge"
          >
            <UploadCloud className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <StatusRow
            icon={CheckCircle2}
            label="Index"
            value={knowledge?.embeddingStatus === "ready" ? "Ready" : "Indexing"}
          />
          <StatusRow icon={Database} label="Indexed chunks" value={`${knowledge?.totalChunks ?? 0}`} />
          <StatusRow icon={Activity} label="Retrieval hits" value={`${hitCount}`} />
        </div>
      </div>

      <Separator className="bg-white/10" />

      <div className="min-h-0 flex-1 space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Documents</p>
        </div>

        <div className="space-y-3 overflow-y-auto pr-1">
          {!documents.length ? (
            <div className="rounded-md border border-dashed border-white/[0.14] bg-black/10 p-4">
              <p className="text-sm text-zinc-300">No documents indexed</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">PDF, DOCX, markdown, text, CSV, and JSON are accepted.</p>
            </div>
          ) : null}
          {documents.map((document, index) => (
            <motion.div
              key={document.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="group rounded-md border border-white/[0.07] bg-[#131411] p-3 transition-colors hover:bg-[#181916]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md border border-white/10 bg-black/30 p-2 text-zinc-300">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-200">{document.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{document.summary}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>{document.chunkCount} chunks</span>
                <span>{document.tokenEstimate.toLocaleString()} tokens</span>
              </div>
              <Progress value={100} className="mt-2 h-1 bg-white/10" />
            </motion.div>
          ))}
        </div>
      </div>

      {hitCount ? (
        <div className="rounded-md border border-white/[0.08] bg-[#11120f] p-3">
          <p className="text-xs font-medium text-zinc-300">Last retrieval</p>
          <div className="mt-2 space-y-2">
            {(knowledge?.retrievalHits ?? []).slice(0, 3).map((hit) => (
              <div key={hit.chunkId} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-zinc-500">{hit.section}</span>
                <span className="font-mono text-zinc-300">{Math.round(hit.score * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <span className="font-mono text-xs text-zinc-300">{value}</span>
    </div>
  );
}
