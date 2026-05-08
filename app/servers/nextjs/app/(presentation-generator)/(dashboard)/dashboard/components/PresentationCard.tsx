'use client'
import React, { useState } from "react";
import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { MoreHorizontal, Trash2, Users, Lock, ExternalLink, Clock } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loadFonts } from "@/app/(presentation-generator)/hooks/useFontLoader";
import SlideScale from "@/app/(presentation-generator)/components/PresentationRender";
import MarkdownRenderer from "@/components/MarkDownRender";

export const PresentationCard = ({
  id,
  title,
  presentation,
  onDeleted,
  userPlan,
}: {
  id: string;
  title: string;
  presentation: any;
  onDeleted?: (presentationId: string) => void;
  userPlan?: string;
}) => {
  const router = useRouter();
  loadFonts(presentation.fonts || []);

  const [visibility, setVisibility] = useState<"private" | "team">(
    presentation.visibility ?? "private"
  );
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`/presentation?id=${id}&type=standard`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this presentation? This cannot be undone.")) return;
    const response = await DashboardApi.deletePresentation(id);
    if (response) {
      toast.success("Presentation deleted");
      if (onDeleted) onDeleted(id);
    } else {
      toast.error("Error deleting presentation");
    }
  };

  const handleToggleVisibility = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = visibility === "private" ? "team" : "private";
    setVisibilityLoading(true);
    try {
      await DashboardApi.updateVisibility(id, next);
      setVisibility(next);
      toast.success(next === "team" ? "Shared with your team" : "Set to private");
    } catch (err: any) {
      toast.error(err?.message || "Could not update sharing");
    } finally {
      setVisibilityLoading(false);
    }
  };

  const firstSlide = presentation?.slides?.[0];
  const isTeamPlan = userPlan === "team";

  const updatedDate = presentation?.updated_at
    ? new Date(presentation.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : presentation?.created_at
    ? new Date(presentation.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  const slideCount = presentation?.slides?.length ?? presentation?.n_slides ?? 0;

  return (
    <div
      onClick={handlePreview}
      className="group relative bg-white rounded-xl border border-violet-100 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-violet-200 hover:-translate-y-0.5 flex flex-col"
    >
      {/* Thumbnail area */}
      <div className="relative bg-slate-100 overflow-hidden" style={{ aspectRatio: "16/10" }}>
        {firstSlide ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="scale-[0.72] origin-center w-full h-full flex items-center justify-center">
              <SlideScale slide={firstSlide} />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-slate-300">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1.5 bg-white text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </div>
        </div>

        {/* Team badge */}
        {visibility === "team" && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-violet-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            <Users className="w-3 h-3" />
            Team
          </div>
        )}

        {/* Slide count badge */}
        {slideCount > 0 && (
          <div className="absolute top-2 right-2 z-10 bg-black/40 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
            {slideCount} slides
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-white">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate leading-tight">
            <MarkdownRenderer
              content={title}
              className="text-sm font-semibold text-slate-900 line-clamp-1 mb-0"
            />
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400">{updatedDate}</span>
          </div>
        </div>

        <Popover>
          <PopoverTrigger
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="w-4 h-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="bg-white border border-slate-200 shadow-xl rounded-xl w-[200px] p-1.5">

            {isTeamPlan && (
              <>
                <button
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700 transition-colors"
                  onClick={handleToggleVisibility}
                  disabled={visibilityLoading}
                >
                  {visibility === "private" ? (
                    <>
                      <Users className="w-4 h-4 text-violet-500 shrink-0" />
                      <span>Share with team</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Make private</span>
                    </>
                  )}
                </button>
                <div className="h-px bg-slate-100 my-1" />
              </>
            )}

            <button
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-red-50 text-sm transition-colors"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-red-600">Delete</span>
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
