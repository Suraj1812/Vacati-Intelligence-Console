"use client";

import { useCallback, useMemo, useState } from "react";
import type React from "react";

import type { ChatMessage, Explainability, RetrievalHit } from "@/lib/ai/types";

type StreamBlock = {
  event: string;
  data: unknown;
};

export function useChatStream(onComplete?: () => Promise<void> | void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const activeAssistantId = useMemo(
    () => messages.findLast((message) => message.role === "assistant")?.id,
    [messages],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const message = content.trim();
      if (!message || isStreaming) {
        return;
      }

      setIsStreaming(true);
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

      setMessages((current) => [...current, userMessage, assistantMessage]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });

        if (!response.ok || !response.body) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error ?? "The AI stream did not start.");
        }

        await consumeStream(response, assistantId, setMessages);
        await onComplete?.();
      } catch (error) {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content:
                    error instanceof Error
                      ? error.message
                      : "I could not complete that request.",
                }
              : item,
          ),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming, onComplete],
  );

  return {
    messages,
    isStreaming,
    activeAssistantId,
    sendMessage,
  };
}

async function consumeStream(
  response: Response,
  assistantId: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
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
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseStreamBlock(block);
      if (!event) continue;

      if (event.event === "token") {
        assistantContent += String(event.data);
      }

      if (event.event === "sources") {
        sources = event.data as RetrievalHit[];
      }

      if (event.event === "explainability") {
        explainability = event.data as Explainability;
      }

      if (event.event === "error") {
        throw new Error((event.data as { message?: string }).message ?? "The AI stream failed.");
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: assistantContent,
                sources,
                explainability,
              }
            : message,
        ),
      );
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

  if (!event || !data) {
    return null;
  }

  return {
    event,
    data: JSON.parse(data),
  };
}
