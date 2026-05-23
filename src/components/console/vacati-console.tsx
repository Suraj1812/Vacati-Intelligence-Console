"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  Menu,
  Send,
  Sparkles,
  UploadCloud,
} from "lucide-react";

import { ChatMessage } from "@/components/console/chat-message";
import { KnowledgeSidebar } from "@/components/console/knowledge-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useKnowledge } from "@/hooks/use-knowledge";

export function VacatiConsole() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    knowledge,
    isUploading,
    fileInputRef,
    refreshKnowledge,
    uploadFiles,
    openUploadDialog,
  } = useKnowledge();
  const { messages, isStreaming, activeAssistantId, sendMessage } = useChatStream(refreshKnowledge);

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  function submitMessage(nextPrompt?: string) {
    const content = (nextPrompt ?? input).trim();
    if (!content) return;
    setInput("");
    void sendMessage(content);
  }

  return (
    <main className="h-screen overflow-hidden bg-[#0b0c0a] text-zinc-100">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
        className="hidden"
        onChange={(event) => void uploadFiles(event.target.files)}
      />

      <div className="mx-auto flex h-full w-full max-w-[1480px] border-x border-white/[0.06] bg-[#0d0e0c]">
        <div className="hidden w-[304px] shrink-0 border-r border-white/[0.08] bg-[#0a0b09] lg:block">
          <KnowledgeSidebar
            knowledge={knowledge}
            isUploading={isUploading}
            onUploadClick={openUploadDialog}
          />
        </div>

        <section className="flex min-w-0 flex-1 flex-col">
          <TopBar
            isUploading={isUploading}
            onUploadClick={openUploadDialog}
            sidebar={
              <KnowledgeSidebar
                knowledge={knowledge}
                isUploading={isUploading}
                onUploadClick={openUploadDialog}
              />
            }
          />

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-12">
              <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-end gap-7">
                {!messages.length ? (
                  <Onboarding
                    hasDocuments={Boolean(knowledge?.documents.length)}
                    onUploadClick={openUploadDialog}
                    onPrompt={submitMessage}
                  />
                ) : (
                  messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      isStreaming={isStreaming && message.id === activeAssistantId}
                    />
                  ))
                )}
                <div ref={scrollRef} />
              </div>
            </div>

            <Composer
              input={input}
              hasDocuments={Boolean(knowledge?.documents.length)}
              isStreaming={isStreaming}
              isUploading={isUploading}
              onInput={setInput}
              onSend={() => submitMessage()}
              onUploadClick={openUploadDialog}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function TopBar({
  isUploading,
  onUploadClick,
  sidebar,
}: {
  isUploading: boolean;
  onUploadClick: () => void;
  sidebar: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0d0e0c]/95 px-4 py-3 backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-md text-zinc-300 hover:bg-white/[0.07] lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[330px] border-white/10 bg-[#090a09] p-0 text-zinc-100">
              {sidebar}
            </SheetContent>
          </Sheet>

          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white text-zinc-950">
            <Image src="/logo.jpeg" alt="" width={36} height={36} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Vacati Intelligence Console</p>
            <p className="hidden text-xs text-zinc-500 sm:block">General answers plus grounded source recall</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-md border border-emerald-200/15 bg-emerald-200/10 px-2.5 py-1.5 text-xs text-emerald-50 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Live
          </span>
          <Link
            href="/status"
            className="hidden rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100 sm:block"
          >
            System status
          </Link>
          <Button
            size="sm"
            className="rounded-md bg-zinc-100 text-zinc-950 hover:bg-white"
            onClick={onUploadClick}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Upload
          </Button>
        </nav>
      </div>
    </header>
  );
}

function Onboarding({
  hasDocuments,
  onUploadClick,
  onPrompt,
}: {
  hasDocuments: boolean;
  onUploadClick: () => void;
  onPrompt: (prompt: string) => void;
}) {
  const prompts = hasDocuments
    ? [
        "Summarize the indexed documents",
        "What should the team verify today?",
        "Find the strongest source-backed recommendation",
      ]
    : [
        "Draft a concise launch checklist",
        "Explain pgvector in simple terms",
        "What should I ask after uploading docs?",
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-start pt-20 pb-12"
    >
      <div className="mb-5 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
        <Sparkles className="h-3.5 w-3.5" />
        New Session
      </div>
      <h1 className="text-2xl font-semibold leading-tight text-zinc-50 sm:text-3xl">New conversation</h1>
      <div className="mt-7 flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="rounded-md border border-white/[0.1] bg-[#141512] px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:border-white/[0.18] hover:bg-[#1a1b18] hover:text-zinc-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button className="rounded-md bg-zinc-100 text-zinc-950 hover:bg-white" onClick={onUploadClick}>
          <UploadCloud className="h-4 w-4" />
          Upload sources
        </Button>
        <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
          <FileText className="h-4 w-4" />
          {hasDocuments ? "Source recall is active" : "General mode is active"}
        </span>
      </div>
    </motion.div>
  );
}

function Composer({
  input,
  hasDocuments,
  isStreaming,
  isUploading,
  onInput,
  onSend,
  onUploadClick,
}: {
  input: string;
  hasDocuments: boolean;
  isStreaming: boolean;
  isUploading: boolean;
  onInput: (value: string) => void;
  onSend: () => void;
  onUploadClick: () => void;
}) {
  return (
    <div className="border-t border-white/[0.08] bg-[#0d0e0c]/95 px-4 py-4 backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-md border border-white/[0.09] bg-[#191a17] p-2 shadow-lg shadow-black/15">
          <Textarea
            value={input}
            onChange={(event) => onInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder={hasDocuments ? "Ask anything, or ask from your uploaded sources..." : "Ask anything..."}
            className="min-h-[74px] resize-none border-0 bg-transparent px-3 py-3 text-[15px] leading-6 text-zinc-100 shadow-none outline-none placeholder:text-zinc-600 focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {hasDocuments ? "Grounded recall active" : "General mode"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 rounded-md text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100"
                onClick={onUploadClick}
                disabled={isUploading}
                aria-label="Upload document"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                size="icon"
                className="h-9 w-9 rounded-md bg-zinc-100 text-zinc-950 hover:bg-white"
                onClick={onSend}
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
              >
                {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
