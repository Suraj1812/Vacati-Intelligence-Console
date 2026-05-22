"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  Menu,
  Send,
  UploadCloud,
} from "lucide-react";

import { ChatMessage } from "@/components/console/chat-message";
import { KnowledgeSidebar } from "@/components/console/knowledge-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useChatStream } from "@/hooks/use-chat-stream";
import { useKnowledge } from "@/hooks/use-knowledge";
import { demoPrompts } from "@/lib/data/demo-documents";

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
    <main className="h-screen overflow-hidden bg-[#070807] text-zinc-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_50%_0%,rgba(89,118,102,0.22),transparent_58%)]" />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md"
        className="hidden"
        onChange={(event) => void uploadFiles(event.target.files)}
      />

      <div className="relative mx-auto flex h-full w-full max-w-[1440px]">
        <div className="hidden w-[320px] shrink-0 border-r border-white/[0.08] lg:block">
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
                    onPrompt={submitMessage}
                    onUploadClick={openUploadDialog}
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
    <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#070807]/85 px-4 py-4 backdrop-blur-xl sm:px-8 lg:px-12">
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
            <p className="hidden text-xs text-zinc-500 sm:block">Ask your uploaded knowledge</p>
          </div>
        </div>

        <nav className="flex items-center gap-2">
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
  onPrompt,
  onUploadClick,
}: {
  hasDocuments: boolean;
  onPrompt: (prompt: string) => void;
  onUploadClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center pt-24 pb-16"
    >
      <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl">
        Ask questions from your own documents.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
        Upload PDFs, menus, guides, or manuals. Vacati answers from indexed content and shows the sources it used.
      </p>

      {hasDocuments ? (
        <div className="mt-10 grid gap-3">
          {demoPrompts.map((prompt, index) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onPrompt(prompt)}
              className="group flex items-center justify-between gap-4 rounded-lg border border-white/[0.08] bg-white/[0.035] px-4 py-4 text-left text-sm text-zinc-300 transition-all hover:border-white/[0.14] hover:bg-white/[0.06]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-black/30 font-mono text-xs text-zinc-500">
                  0{index + 1}
                </span>
                {prompt}
              </span>
              <ArrowRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-300" />
            </button>
          ))}
        </div>
      ) : (
        <Button
          className="mt-9 w-fit rounded-md bg-zinc-100 text-zinc-950 hover:bg-white"
          onClick={onUploadClick}
        >
          <UploadCloud className="h-4 w-4" />
          Upload documents
        </Button>
      )}
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
    <div className="border-t border-white/[0.08] bg-[#070807]/90 px-4 py-4 backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-white/[0.09] bg-white/[0.045] p-2 shadow-2xl shadow-black/30">
          <Textarea
            value={input}
            onChange={(event) => onInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder={hasDocuments ? "Ask about a menu, wine pairing, service recovery, or uploaded manual..." : "Upload documents to begin..."}
            className="min-h-[74px] resize-none border-0 bg-transparent px-3 py-3 text-[15px] leading-6 text-zinc-100 shadow-none outline-none placeholder:text-zinc-600 focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-1">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {hasDocuments ? "Ready" : "Upload documents first"}
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
                disabled={!hasDocuments || !input.trim() || isStreaming}
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
