"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070807] px-6 text-zinc-100">
      <section className="max-w-md">
        <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-md border border-amber-200/20 bg-amber-200/10 text-amber-100">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="text-3xl font-semibold">The console hit an unstable state.</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-500">
          The runtime caught the error safely. Retry the view, or check the system status page if the AI provider is unavailable.
        </p>
        <Button className="mt-8 rounded-md bg-zinc-100 text-zinc-950 hover:bg-white" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          Retry
        </Button>
      </section>
    </main>
  );
}
