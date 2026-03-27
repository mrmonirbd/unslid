import React from "react";
import { PresentationCard } from "./PresentationCard";
import { useRouter } from "next/navigation";
import { PresentationResponse } from "@/app/(presentation-generator)/services/api/dashboard";
import { Plus, Presentation } from "lucide-react";

interface PresentationGridProps {
  presentations: PresentationResponse[];
  type: "slide" | "video";
  isLoading?: boolean;
  error?: string | null;
  onPresentationDeleted?: (presentationId: string) => void;
  userPlan?: string;
}

export const PresentationGrid = ({
  presentations,
  type,
  isLoading = false,
  error = null,
  onPresentationDeleted,
  userPlan,
}: PresentationGridProps) => {
  const router = useRouter();

  const handleCreate = () => {
    router.push(type === "slide" ? "/upload" : "/editor");
  };

  const ShimmerCard = () => (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="bg-slate-100" style={{ aspectRatio: "16/10" }} />
      <div className="px-4 py-3 border-t border-slate-100 space-y-2">
        <div className="h-3.5 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );

  const CreateNewCard = () => (
    <div
      onClick={handleCreate}
      className="group relative bg-white rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center text-center overflow-hidden"
      style={{ minHeight: "200px" }}
    >
      <div className="p-3 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 transition-colors mb-3">
        <Plus className="w-6 h-6 text-indigo-600" />
      </div>
      <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">
        新規作成
      </p>
      <p className="text-xs text-slate-400 mt-1">AIでゼロから作成</p>
    </div>
  );

  const EmptyState = () => (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Presentation className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">プレゼンはまだありません</h3>
      <p className="text-sm text-slate-400 mb-5 max-w-xs">
        1分以内にAIで最初のプレゼンを作成しましょう。
      </p>
      <button
        onClick={handleCreate}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-white text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-sm shadow-indigo-500/25"
      >
        <Plus className="w-4 h-4" />
        最初のプレゼンを作成
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <div
          className="bg-white rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center animate-pulse"
          style={{ minHeight: "200px" }}
        >
          <div className="w-12 h-12 rounded-xl bg-slate-100 mb-3" />
          <div className="h-3 bg-slate-200 rounded w-28 mb-2" />
          <div className="h-2.5 bg-slate-100 rounded w-36" />
        </div>
        {[...Array(7)].map((_, i) => (
          <ShimmerCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <CreateNewCard />
        <div className="col-span-3 flex items-center justify-center py-16 text-center">
          <div>
            <p className="text-slate-500 mb-3">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium underline"
            >
              再試行
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!presentations || presentations.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        <CreateNewCard />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      <CreateNewCard />
      {presentations.map((presentation) => (
        <PresentationCard
          key={presentation.id}
          id={presentation.id}
          title={presentation.title}
          presentation={presentation}
          onDeleted={onPresentationDeleted}
          userPlan={userPlan}
        />
      ))}
    </div>
  );
};
