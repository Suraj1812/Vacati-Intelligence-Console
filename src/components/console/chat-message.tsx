"use client";

import Image from "next/image";
import { BookOpen, Gauge, Link2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import type { ChatMessage as ChatMessageType } from "@/lib/ai/types";
import { Separator } from "@/components/ui/separator";

type ChatMessageProps = {
  message: ChatMessageType;
  isStreaming?: boolean;
};

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isAssistant = message.role === "assistant";

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={isAssistant ? "mx-auto w-full max-w-3xl" : "ml-auto w-full max-w-2xl"}
    >
      <div
        className={
          isAssistant
            ? "space-y-5"
            : "rounded-md border border-white/[0.08] bg-[#171816] px-4 py-3 text-zinc-100 shadow-lg shadow-black/10"
        }
      >
        {isAssistant ? (
          <div className="flex gap-4">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white">
              <Image src="/logo.jpeg" alt="" width={32} height={32} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              {message.content ? (
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-zinc-100">{message.content}</p>
              ) : (
                <LoadingLine />
              )}
            </div>
          </div>
        ) : (
          <p className="text-[15px] leading-6">{message.content}</p>
        )}

        {isAssistant && message.explainability ? (
          <Explainability message={message} isStreaming={isStreaming} />
        ) : null}
      </div>
    </motion.article>
  );
}

function LoadingLine() {
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-500">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-40" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
      </span>
      Working
    </div>
  );
}

function Explainability({
  message,
  isStreaming,
}: {
  message: ChatMessageType;
  isStreaming?: boolean;
}) {
  const explainability = message.explainability;
  if (!explainability) {
    return null;
  }

  if (explainability.mode === "general") {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        className="ml-12 flex flex-wrap items-center gap-2 border-l border-white/[0.1] pl-4 text-xs text-zinc-500"
      >
        <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-300/15 bg-sky-300/10 px-2 py-1 text-sky-100">
          <Sparkles className="h-3.5 w-3.5" />
          General answer
        </span>
        <span>{explainability.flavorLogic}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="ml-12 border-l border-white/[0.12] pl-4"
    >
      <p className="text-xs font-medium text-zinc-500">Source details</p>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Reason icon={BookOpen} label="Why this answer" value={explainability.why} />
          <Reason icon={Link2} label="Reasoning" value={explainability.flavorLogic} />
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span className="flex items-center gap-2">
                <Gauge className="h-3.5 w-3.5" />
                Confidence
              </span>
              <span className="font-mono text-zinc-300">
                {Math.round(explainability.confidence * 100)}%
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-300"
                style={{ width: `${Math.round(explainability.confidence * 100)}%` }}
              />
            </div>
          </div>

          <Separator className="bg-white/10" />

          <div>
            <p className="text-xs text-zinc-500">Context retrieved from documents</p>
            <div className="mt-2 space-y-2">
              {explainability.retrievedContext.map((context) => (
                <p key={context} className="rounded-md bg-black/20 px-2 py-1.5 text-xs text-zinc-400">
                  {context}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      {message.sources?.length ? (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
          {message.sources.slice(0, 3).map((source, index) => (
            <span key={source.chunkId} className="rounded-md border border-white/10 px-2 py-1">
              [{index + 1}] {source.documentName}
            </span>
          ))}
        </div>
      ) : null}

      {isStreaming ? <p className="mt-3 text-xs text-zinc-600">Updating live</p> : null}
    </motion.div>
  );
}

function Reason({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-zinc-300">{value}</p>
    </div>
  );
}
