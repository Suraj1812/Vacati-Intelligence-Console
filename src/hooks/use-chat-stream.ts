"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

import type { ChatMessage, ChatSession, Explainability, RetrievalHit } from "@/lib/ai/types";

type StreamBlock = {
  event: string;
  data: unknown;
};

const STORAGE_KEY = "vacati.chat.sessions.v1";

export function useChatStream(onComplete?: () => Promise<void> | void) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const messages = activeSession?.messages ?? [];
  const activeAssistantId = useMemo(
    () => messages.findLast((message) => message.role === "assistant")?.id,
    [messages],
  );

  useEffect(() => {
    const stored = loadSessions();
    if (stored.length) {
      setSessions(stored);
      setActiveSessionId(stored[0].id);
      return;
    }

    const session = createSession();
    setSessions([session]);
    setActiveSessionId(session.id);
  }, []);

  useEffect(() => {
    if (sessions.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 30)));
    }
  }, [sessions]);

  const updateActiveMessages = useCallback(
    (updater: (messages: ChatMessage[]) => ChatMessage[]) => {
      setSessions((current) =>
        current.map((session) =>
          session.id === activeSessionId
            ? { ...session, updatedAt: new Date().toISOString(), messages: updater(session.messages) }
            : session,
        ),
      );
    },
    [activeSessionId],
  );

  const sendMessage = useCallback(
    async (content: string, options: { replaceLastAssistant?: boolean } = {}) => {
      const message = content.trim();
      if (!message || isStreaming || !activeSessionId) {
        return;
      }

      const history = messages
        .filter((item) => item.content.trim())
        .slice(-8)
        .map((item) => ({ role: item.role, content: item.content }));
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      const assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      setIsStreaming(true);
      abortRef.current = new AbortController();
      updateActiveMessages((current) => {
        const base = options.replaceLastAssistant ? current.filter((item) => item.id !== activeAssistantId) : current;
        return [...base, userMessage, assistantMessage];
      });
      setSessions((current) => renameUntitledSession(current, activeSessionId, message));

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history }),
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error ?? "The AI stream did not start.");
        }

        await consumeStream(response, activeSessionId, assistantId, setSessions);
        await onComplete?.();
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          updateMessage(activeSessionId, assistantId, setSessions, (item) => ({
            ...item,
            content: item.content || "Stopped.",
          }));
        } else {
          updateMessage(activeSessionId, assistantId, setSessions, (item) => ({
            ...item,
            content: error instanceof Error ? error.message : "I could not complete that request.",
          }));
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [activeAssistantId, activeSessionId, isStreaming, messages, onComplete, updateActiveMessages],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerateLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (lastUser) {
      void sendMessage(lastUser.content, { replaceLastAssistant: true });
    }
  }, [messages, sendMessage]);

  const newSession = useCallback(() => {
    const session = createSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
  }, []);

  const renameSession = useCallback((id: string, title: string) => {
    setSessions((current) =>
      current.map((session) => (session.id === id ? { ...session, title: title.trim() || session.title } : session)),
    );
  }, []);

  const togglePinned = useCallback((id: string) => {
    setSessions((current) =>
      current
        .map((session) => (session.id === id ? { ...session, pinned: !session.pinned } : session))
        .sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt.localeCompare(left.updatedAt)),
    );
  }, []);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    messages,
    isStreaming,
    activeAssistantId,
    sendMessage,
    stopGeneration,
    regenerateLast,
    newSession,
    renameSession,
    togglePinned,
  };
}

async function consumeStream(
  response: Response,
  sessionId: string,
  assistantId: string,
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
) {
  let assistantContent = "";
  let sources: RetrievalHit[] = [];
  let explainability: Explainability | undefined;
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("The AI stream was not readable.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseStreamBlock(block);
      if (!event) continue;

      if (event.event === "token") assistantContent += String(event.data);
      if (event.event === "sources") sources = event.data as RetrievalHit[];
      if (event.event === "explainability") explainability = event.data as Explainability;
      if (event.event === "error") {
        throw new Error((event.data as { message?: string }).message ?? "The AI stream failed.");
      }

      updateMessage(sessionId, assistantId, setSessions, (message) => ({
        ...message,
        content: assistantContent,
        sources,
        explainability,
      }));
    }
  }
}

function parseStreamBlock(block: string): StreamBlock | null {
  const event = block
    .split("\n")
    .find((line) => line.startsWith("event:"))
    ?.replace("event:", "")
    .trim();
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.replace("data:", "").trim())
    .join("\n");

  if (!event || !data) return null;
  return { event, data: JSON.parse(data) };
}

function updateMessage(
  sessionId: string,
  messageId: string,
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>,
  updater: (message: ChatMessage) => ChatMessage,
) {
  setSessions((current) =>
    current.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            updatedAt: new Date().toISOString(),
            messages: session.messages.map((message) => (message.id === messageId ? updater(message) : message)),
          }
        : session,
    ),
  );
}

function createSession(): ChatSession {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    pinned: false,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function loadSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as ChatSession[];
    return Array.isArray(parsed) ? parsed.filter((session) => session.id && Array.isArray(session.messages)) : [];
  } catch {
    return [];
  }
}

function renameUntitledSession(sessions: ChatSession[], id: string, firstMessage: string) {
  return sessions.map((session) =>
    session.id === id && session.title === "New conversation"
      ? { ...session, title: firstMessage.slice(0, 48), updatedAt: new Date().toISOString() }
      : session,
  );
}
