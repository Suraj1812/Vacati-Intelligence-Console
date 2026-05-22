import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#070807] p-6 text-zinc-100">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl gap-8">
        <aside className="hidden w-72 space-y-4 border-r border-white/10 pr-6 lg:block">
          <Skeleton className="h-8 w-36 bg-white/10" />
          <Skeleton className="h-24 w-full bg-white/10" />
          <Skeleton className="h-24 w-full bg-white/10" />
          <Skeleton className="h-24 w-full bg-white/10" />
        </aside>
        <section className="flex flex-1 flex-col justify-center">
          <Skeleton className="h-10 w-56 bg-white/10" />
          <Skeleton className="mt-8 h-28 w-full max-w-2xl bg-white/10" />
          <Skeleton className="mt-10 h-16 w-full max-w-3xl bg-white/10" />
        </section>
      </div>
    </main>
  );
}
