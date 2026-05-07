import { Search } from "lucide-react";
import React from "react";

const TAG_PLACEHOLDERS = ["All", "Biricani", "Common", "Purpose", "General", "Modern", "Standard", "Swift", "Free", "Marketing"];
const CARD_PLACEHOLDERS = Array.from({ length: 8 });
const PREVIEW_PLACEHOLDERS = Array.from({ length: 4 });

const TemplateCardSkeleton = ({ isCreateCard = false }: { isCreateCard?: boolean }) => (
  <div className="relative h-[210px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-none">
    <div className="absolute inset-0 bg-[radial-gradient(circle,#d9dde6_1.5px,transparent_1.5px)] [background-size:32px_32px] opacity-55" />
    <div className="relative p-4">
      {isCreateCard ? (
        <div className="flex h-[128px] items-center justify-center">
          <div className="h-10 w-10 rounded-full border-4 border-slate-200 bg-white" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {PREVIEW_PLACEHOLDERS.map((_, index) => (
            <div key={index} className="aspect-video rounded border border-slate-200 bg-white/80 shadow-sm">
              <div className="m-3 h-2 w-1/2 rounded bg-slate-100" />
              <div className="mx-3 mt-2 h-1.5 w-3/4 rounded bg-slate-100" />
              <div className="mx-3 mt-1.5 h-1.5 w-2/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="absolute inset-x-0 bottom-0 z-10 border-t border-[#EDEEEF] bg-white px-4 py-3">
      <div className="h-4 w-32 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-56 max-w-full rounded bg-slate-100" />
    </div>
  </div>
);

const Loading = () => {
  return (
    <div className="min-h-screen animate-pulse bg-white font-syne text-slate-950">
      <div className="rounded-b-[28px] bg-[linear-gradient(115deg,#b7f3ee_0%,#f9fbff_44%,#d7b6ff_100%)] px-6 pb-12 pt-14 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center">
          <div className="h-12 w-80 max-w-full rounded-2xl bg-white/50" />
          <div className="relative mt-7 h-16 w-full max-w-3xl rounded-2xl border border-violet-200 bg-white/95 shadow-[0_18px_50px_rgba(124,58,237,0.12)]">
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-300" />
            <div className="ml-14 mt-6 h-3 w-48 rounded bg-slate-100" />
          </div>
        </div>
      </div>

      <main className="px-6 py-8 md:px-10">
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="h-7 w-56 rounded bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          {TAG_PLACEHOLDERS.map((tag, index) => (
            <div
              key={tag}
              className={`h-9 rounded-full ${index === 0 ? "w-12 bg-slate-950" : "w-28 border border-violet-200 bg-white"}`}
            />
          ))}
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-7 w-80 max-w-full rounded bg-slate-200" />
            <div className="h-10 w-10 rounded-full border border-slate-200 bg-white shadow-sm" />
          </div>

          <div className="grid grid-cols-1 gap-6 pb-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <TemplateCardSkeleton isCreateCard />
            {CARD_PLACEHOLDERS.map((_, index) => (
              <TemplateCardSkeleton key={index} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Loading;
