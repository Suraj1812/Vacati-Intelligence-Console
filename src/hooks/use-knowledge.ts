"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { KnowledgeState } from "@/lib/ai/types";

export function useKnowledge() {
  const [knowledge, setKnowledge] = useState<KnowledgeState | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshKnowledge = useCallback(async () => {
    const response = await fetch("/api/knowledge", { cache: "no-store" });
    if (response.ok) {
      setKnowledge((await response.json()) as KnowledgeState);
    }
  }, []);

  const uploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) {
        return;
      }

      setIsUploading(true);
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));

      try {
        const response = await fetch("/api/knowledge", {
          method: "POST",
          body: form,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Upload failed.");
        }

        setKnowledge(result.knowledge);
        toast.success(`${result.chunksIndexed} chunks indexed`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed.");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [],
  );

  useEffect(() => {
    void refreshKnowledge();
  }, [refreshKnowledge]);

  return {
    knowledge,
    isUploading,
    fileInputRef,
    refreshKnowledge,
    uploadFiles,
    openUploadDialog: () => fileInputRef.current?.click(),
  };
}
