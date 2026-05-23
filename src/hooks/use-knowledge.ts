"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { KnowledgeState } from "@/lib/ai/types";

type UploadResponse = {
  chunksIndexed: number;
  failed?: Array<{ name: string; error: string }>;
  knowledge: KnowledgeState;
};

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
        const result = (await response.json()) as Partial<UploadResponse> & { error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? "Upload failed.");
        }

        if (result.knowledge) {
          setKnowledge(result.knowledge);
        }

        if (result.failed?.length) {
          toast.warning(`${result.chunksIndexed ?? 0} chunks indexed; ${result.failed.length} file failed`);
        } else {
          toast.success(`${result.chunksIndexed ?? 0} chunks indexed`);
        }
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
