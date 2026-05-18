"use client";
import { Button } from "@/components/ui/button";
import {
  Play,
  Loader2,
  Redo2,
  Undo2,
  RotateCcw,
  ArrowRightFromLine,
  ArrowUpRight,
  History,
  Save,
  Clock,
  Maximize,
  Check,
  Share2,
  Copy,
  Lock,
  Globe,
  Eye,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { useDispatch, useSelector } from "react-redux";


import { RootState } from "@/store/store";
import { toast } from "sonner";


import { PptxPresentationModel } from "@/types/pptx_models";
import { extractPresentationPptxModel } from "@/utils/pptx-extractor-client";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { usePresentationUndoRedo } from "../hooks/PresentationUndoRedo";
import ToolTip from "@/components/ToolTip";
import { clearPresentationData, updateTheme } from "@/store/slices/presentationGeneration";
import { clearHistory } from "@/store/slices/undoRedoSlice";
import { Separator } from "@/components/ui/separator";
import ThemeSelector from "./ThemeSelector";
import { DEFAULT_THEMES } from "../../(dashboard)/theme/components/ThemePanel/constants";
import ThemeApi from "../../services/api/theme";
import { Theme } from "../../services/api/types";
import MarkdownRenderer from "@/components/MarkDownRender";

interface VersionEntry {
  id: number;
  version_number: number;
  label: string;
  slide_count: number;
  created_at: string;
}

const PresentationHeader = ({
  presentation_id,
  isPresentationSaving,
  currentSlide,
}: {
  presentation_id: string;
  isPresentationSaving: boolean;
  currentSlide?: number;
}) => {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editCountRef = useRef(0);
  const [resizeOpen, setResizeOpen] = useState(false);
  const [currentRatio, setCurrentRatio] = useState<string>("16:9");
  const [resizing, setResizing] = useState(false);

  // Share state
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState<"public" | "password" | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareViewCount, setShareViewCount] = useState<number | null>(null);

  const RATIOS = [
    { key: "16:9", label: "Widescreen 16:9", desc: "Standard presentation" },
    { key: "4:3", label: "Classic 4:3", desc: "Traditional slides" },
    { key: "9:16", label: "Portrait 9:16", desc: "Mobile / social" },
    { key: "1:1", label: "Square 1:1", desc: "LinkedIn / Instagram" },
    { key: "A4", label: "A4 Portrait", desc: "Document / printable" },
  ];

  const pathname = usePathname();
  const dispatch = useDispatch();

  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  // Sync aspect ratio from loaded presentation data
  useEffect(() => {
    const ratio = (presentationData?.theme as any)?.aspect_ratio;
    if (ratio) setCurrentRatio(ratio);
  }, [presentationData?.theme]);

  useEffect(() => {
    const load = async () => {
      try {
        const [customThemes] = await Promise.all([
          ThemeApi.getThemes(),
        ]);
        setThemes([...customThemes, ...DEFAULT_THEMES]);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load themes");
      }
    };
    if (themes.length === 0) {
      load();
    }
  }, []);

  const { onUndo, onRedo, canUndo, canRedo } = usePresentationUndoRedo();

  const loadVersions = async () => {
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/v1/ppt/presentation/${presentation_id}/versions`, {
        headers: await (async () => {
          const { getHeader } = await import("../../services/api/header");
          return getHeader();
        })(),
      });
      const data = await res.json();
      setVersions(Array.isArray(data) ? data : []);
    } finally {
      setVersionsLoading(false);
    }
  };

  const handleSaveVersion = async () => {
    setSavingVersion(true);
    try {
      await fetch(`/api/v1/ppt/presentation/${presentation_id}/versions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...await (async () => {
            const { getHeader } = await import("../../services/api/header");
            return getHeader();
          })(),
        },
        body: JSON.stringify({}),
      });
      await loadVersions();
      toast.success("Version saved");
    } finally {
      setSavingVersion(false);
    }
  };

  const handleRestoreVersion = async (versionId: number) => {
    if (!confirm("Restore this version? Current slide changes will be replaced.")) return;
    setRestoringVersion(versionId);
    try {
      await fetch(`/api/v1/ppt/presentation/${presentation_id}/versions/${versionId}/restore`, {
        method: "POST",
        headers: await (async () => {
          const { getHeader } = await import("../../services/api/header");
          return getHeader();
        })(),
      });
      toast.success("Version restored — reloading…");
      setTimeout(() => window.location.reload(), 800);
    } finally {
      setRestoringVersion(null);
    }
  };

  const handleResize = async (ratio: string) => {
    setResizing(true);
    try {
      const { getHeader } = await import("../../services/api/header");
      const res = await fetch(`/api/v1/ppt/presentation/${presentation_id}/resize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getHeader()) },
        body: JSON.stringify({ aspect_ratio: ratio }),
      });
      if (!res.ok) {
        throw new Error("Failed to resize presentation");
      }

      const resized = await res.json();
      setCurrentRatio(ratio);
      dispatch(updateTheme({
        ...(presentationData?.theme || {}),
        aspect_ratio: resized.aspect_ratio,
        slide_width_px: resized.width_px,
        slide_height_px: resized.height_px,
      } as any));
      toast.success(`Resized to ${ratio}`);
      setResizeOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to resize presentation");
    } finally {
      setResizing(false);
    }
  };

  // Legacy Puppeteer-based extractor — kept as fallback only
  const get_presentation_pptx_model_puppeteer = async (id: string): Promise<PptxPresentationModel> => {
    const response = await fetch(`/api/presentation_to_pptx_model?id=${id}`);
    const data = await response.json();
    if (!response.ok) {
      const message =
        data?.detail || data?.message || "Failed to build presentation PPTX model";
      throw new Error(message);
    }
    return data;
  };

  const exportViaIpc = async (format: "pptx" | "pdf"): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!(window as any).electron?.exportPresentation) return false;
    trackEvent(
      format === "pptx"
        ? MixpanelEvent.Header_ExportAsPPTX_API_Call
        : MixpanelEvent.Header_ExportAsPDF_API_Call
    );
    const result = await (window as any).electron.exportPresentation(
      presentation_id,
      presentationData?.title || 'presentation',
      format
    );
    if (!result?.success) {
      throw new Error(result?.message || 'Export failed');
    }
    return true;
  };

  const handleExportPptx = async () => {
    if (isStreaming) return;

    try {
      setIsExporting(true);
      trackEvent(MixpanelEvent.Header_UpdatePresentationContent_API_Call);
      await PresentationGenerationApi.updatePresentationContent(presentationData);

      if (await exportViaIpc("pptx")) {
        toast.success("PPTX exported successfully!");
        return;
      }

      trackEvent(MixpanelEvent.Header_GetPptxModel_API_Call);

      // Fast path: extract PPTX model directly from the already-rendered DOM
      // (no Puppeteer, no headless browser — 3-8 s vs 15-60 s)
      let pptx_model: PptxPresentationModel;
      try {
        pptx_model = await extractPresentationPptxModel(presentationData?.title);
      } catch (clientErr) {
        console.warn("Client-side extraction failed, falling back to Puppeteer:", clientErr);
        pptx_model = await get_presentation_pptx_model_puppeteer(presentation_id);
      }

      if (!pptx_model) throw new Error("Failed to build presentation PPTX model");
      pptx_model.pptx_template_id = (presentationData as any)?.pptx_template_id ?? null;

      trackEvent(MixpanelEvent.Header_ExportAsPPTX_API_Call);
      const pptxBlob = await PresentationGenerationApi.exportAsPPTX(pptx_model);
      const rawTitle = presentationData?.title ?? "presentation";
      const safeTitle = rawTitle.replace(/[^a-z0-9_\-. ]/gi, "_");
      const blobUrl = URL.createObjectURL(pptxBlob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${safeTitle}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Having trouble exporting!", {
        description: "We are having trouble exporting your presentation. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (isStreaming) return;

    try {
      setIsExporting(true);
      trackEvent(MixpanelEvent.Header_UpdatePresentationContent_API_Call);
      await PresentationGenerationApi.updatePresentationContent(presentationData);

      trackEvent(MixpanelEvent.Header_ExportAsPDF_API_Call);
      if (await exportViaIpc("pdf")) {
        toast.success("PDF exported successfully!");
        return;
      }

      // Fast path: extract DOM → build PPTX → LibreOffice → PDF (~5-10 s vs 15-60 s)
      let pdfBlob: Blob | null = null;
      try {
        const pptx_model = await extractPresentationPptxModel(presentationData?.title);
        pptx_model.pptx_template_id = (presentationData as any)?.pptx_template_id ?? null;
        pdfBlob = await PresentationGenerationApi.exportAsPDFFromModel(pptx_model);
      } catch (fastErr) {
        console.warn("Fast PDF export failed, falling back to Puppeteer:", fastErr);
      }

      if (pdfBlob) {
        const rawTitle = presentationData?.title ?? "presentation";
        const safeTitle = rawTitle.replace(/[^a-z0-9_\-. ]/gi, "_");
        const blobUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${safeTitle}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
        return;
      }

      // Fallback: Puppeteer-based PDF export
      const response = await fetch('/api/export-as-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: presentation_id,
          title: presentationData?.title,
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const rawTitle = presentationData?.title ?? "presentation";
        a.download = `${rawTitle.replace(/[^a-z0-9_\-. ]/gi, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to export PDF");
      }

    } catch (err) {
      console.error(err);
      toast.error("Having trouble exporting!", {
        description:
          "We are having trouble exporting your presentation. Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };
  const handleShareOpen = async (open: boolean) => {
    setShareOpen(open);
    if (open && !shareUrl) {
      // Reset to unselected state each time the popover opens fresh
      setShareMode(null);
      setSharePassword("");
      try {
        const { getHeader } = await import("../../services/api/header");
        const res = await fetch("/api/v1/account/shares", { headers: await getHeader() });
        if (res.ok) {
          const shares = await res.json();
          const existing = (shares as any[]).find((s) => s.presentation_id === presentation_id);
          if (existing) {
            setShareUrl(`${window.location.origin}/s/${existing.token}`);
            setShareMode(existing.mode === "password" ? "password" : "public");
            setShareViewCount(existing.view_count ?? 0);
          }
        }
      } catch {}
    }
  };

  const handleCreateShare = async () => {
    if (!shareMode) return;
    setShareLoading(true);
    try {
      const { getHeader } = await import("../../services/api/header");
      const res = await fetch("/api/v1/account/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getHeader()) },
        body: JSON.stringify({
          presentation_id,
          mode: shareMode,
          password: shareMode === "password" ? sharePassword : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create share link");
      const data = await res.json();
      const url = `${window.location.origin}/s/${data.token}`;
      setShareUrl(url);
      setShareViewCount(data.view_count ?? 0);
      // Auto-copy
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
    toast.success("Link copied!");
  };

  const handleReGenerate = () => {
    dispatch(clearPresentationData());
    dispatch(clearHistory())
    trackEvent(MixpanelEvent.Header_ReGenerate_Button_Clicked, { pathname });
    router.push(`/presentation?id=${presentation_id}&stream=true`);
  };
  const downloadLink = (path: string) => {
    // if we have popup access give direct download if not redirect to the path
    if (window.opener) {
      window.open(path, '_blank');
    } else {
      const link = document.createElement('a');
      link.href = path;
      link.download = path.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
    }
  };

  const ExportOptions = ({ mobile }: { mobile: boolean }) => (
    <div className={` rounded-[18px] max-md:mt-4 ${mobile ? "" : "bg-white"}  p-5`}>
      <p className="text-sm font-medium text-[#19001F]">Export as</p>
      <div className="my-[18px] h-[1px] bg-[#E8E8E8]" />
      <div className="space-y-3">

        <Button
          onClick={() => {
            trackEvent(MixpanelEvent.Header_Export_PDF_Button_Clicked, { pathname });
            handleExportPdf();
            setOpen(false);
          }}
          variant="ghost"
          className={`  rounded-none px-0 w-full text-xs flex justify-start text-black hover:bg-transparent ${mobile ? "bg-white py-6 border-none rounded-lg" : ""}`} >

          PDF
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          onClick={() => {
            trackEvent(MixpanelEvent.Header_Export_PPTX_Button_Clicked, { pathname });
            handleExportPptx();
            setOpen(false);
          }}
          variant="ghost"
          className={`w-full flex px-0 justify-start text-xs text-black hover:bg-transparent  ${mobile ? "bg-white py-6" : ""}`}
        >

          PPTX
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
      </div>


    </div>
  );




  return (
    <>
      {/* Version history slide-over panel */}
      {historyOpen && (
        <div className="fixed inset-0 z-[200] flex">
          <div className="flex-1 bg-black/40" onClick={() => setHistoryOpen(false)} />
          <div className="flex h-full w-[min(20rem,86vw)] flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-slate-800 text-sm">Version history</span>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>

            <div className="px-4 py-3 border-b border-slate-100">
              <button
                onClick={handleSaveVersion}
                disabled={savingVersion}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
              >
                <Save className="w-4 h-4" />
                {savingVersion ? "Saving…" : "Save current version"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {versionsLoading && <p className="text-sm text-slate-400 text-center py-4">Loading…</p>}
              {!versionsLoading && versions.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No saved versions yet.</p>
              )}
              {versions.map((v) => (
                <div key={v.id} className="border border-slate-200 rounded-xl p-3 hover:border-indigo-200 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{v.label}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(v.created_at).toLocaleString()}
                        <span>· {v.slide_count} slides</span>
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestoreVersion(v.id)}
                      disabled={restoringVersion === v.id}
                      className="shrink-0 text-xs px-2.5 py-1.5 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 rounded-lg transition disabled:opacity-50"
                    >
                      {restoringVersion === v.id ? "…" : "Restore"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-50 mb-4 flex flex-col gap-3 bg-white py-4 font-syne md:mb-[17px] md:flex-row md:items-center md:justify-between md:py-7">
        <div className="flex min-w-0 items-center gap-3">
          <ToolTip content="Back to Dashboard">
            <Link
              href="/dashboard"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-[#5141e5] hover:bg-[#F6F6F9] border border-transparent hover:border-[#EDECEC] transition-all shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </ToolTip>
          <div className="w-px h-4 bg-slate-200 shrink-0" />
          <h2 className="text-lg text-[#101323] font-unbounded min-w-0">
            <MarkdownRenderer content={presentationData?.title || "Presentation"} className="mb-0 max-w-[400px] truncate text-sm text-[#101323]" />
          </h2>
        </div>
        <div className="flex max-w-full items-center gap-2.5 overflow-x-auto pb-1 md:overflow-visible md:pb-0">

          {isPresentationSaving && <div className="flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>}
          <ThemeSelector presentation_id={presentation_id} current_theme={presentationData?.theme || {}} themes={themes} />

          {/* History button */}
          <ToolTip content="Version history">
            <button
              onClick={() => { setHistoryOpen(true); loadVersions(); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F6F6F9] border border-[#EDECEC] rounded-[80px] text-xs text-slate-600 hover:text-[#5141e5] transition"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">History</span>
            </button>
          </ToolTip>

          {/* Resize button */}
          <Popover open={resizeOpen} onOpenChange={setResizeOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-[#F6F6F9] border border-[#EDECEC] rounded-[80px] text-xs text-slate-600 hover:text-[#5141e5] transition">
                <Maximize className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{currentRatio}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[220px] p-2 rounded-xl shadow-xl border border-slate-200">
              <p className="text-xs font-semibold text-slate-500 px-2 py-1 uppercase tracking-widest">Aspect ratio</p>
              {RATIOS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => handleResize(r.key)}
                  disabled={resizing}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-indigo-50 transition text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.desc}</p>
                  </div>
                  {currentRatio === r.key && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 bg-[#F6F6F9] px-3.5 h-[38px] border border-[#EDECEC] rounded-[80px]">

            <ToolTip content="Regenerate Presentation">
              <button onClick={handleReGenerate} className="group">
                <RotateCcw className="w-3.5 h-3.5 text-[#101323] group-hover:text-[#5141e5] duration-300" />
              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4" />
            <ToolTip content="Undo">
              <button disabled={!canUndo} className=" disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group" onClick={() => {
                onUndo();
              }}>

                <Undo2 className="w-3.5 h-3.5 text-[#101323] group-hover:text-[#5141e5] duration-300" />

              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4" />
            <ToolTip content="Redo">

              <button disabled={!canRedo} className=" disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group" onClick={() => {

                onRedo();
              }}>
                <Redo2 className="w-3.5 h-3.5 text-[#101323] group-hover:text-[#5141e5] duration-300" />

              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4 w-[2px]" />
            <ToolTip content="Present">
              <button
                onClick={() => {
                  const to = `?id=${presentation_id}&mode=present&slide=${currentSlide || 0}`;
                  trackEvent(MixpanelEvent.Navigation, { from: pathname, to });
                  router.push(to);
                }}
                disabled={!presentationData?.slides || presentationData?.slides.length === 0} className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group">
                <Play className="w-3.5 h-3.5 text-[#101323] group-hover:text-[#5141e5] duration-300" />
              </button>
            </ToolTip>
          </div>

          {/* Share button */}
          <Popover open={shareOpen} onOpenChange={handleShareOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-2 bg-[#F6F6F9] border border-[#EDECEC] rounded-[80px] text-xs text-slate-600 hover:text-[#5141e5] transition">
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Share</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 p-0 shadow-2xl">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="font-semibold text-slate-900 text-sm">Share presentation</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {shareUrl ? "Active share link" : "Not shared — choose access type below"}
                </p>
              </div>

              <div className="px-5 py-4 space-y-4">

                {/* Existing share link display (shown first if already shared) */}
                {shareUrl && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-xs text-slate-600 truncate flex-1 font-mono">{shareUrl}</span>
                      <button
                        onClick={handleCopyLink}
                        className="shrink-0 p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition"
                      >
                        {shareCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      {shareViewCount !== null && (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <Eye className="w-3 h-3" />
                          {shareViewCount} {shareViewCount === 1 ? "view" : "views"}
                        </span>
                      )}
                      <a
                        href="/settings/analytics"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 ml-auto"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Analytics
                      </a>
                    </div>
                    <div className="h-px bg-slate-100" />
                  </div>
                )}

                {/* Mode toggle — must be explicitly chosen */}
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    {shareUrl ? "Update access type" : "Select access type"}
                  </p>
                  <div className="flex rounded-xl overflow-hidden border border-slate-200">
                    <button
                      onClick={() => { setShareMode(shareMode === "public" ? null : "public"); if (shareUrl) setShareUrl(null); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${shareMode === "public" ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Public
                    </button>
                    <button
                      onClick={() => { setShareMode(shareMode === "password" ? null : "password"); if (shareUrl) setShareUrl(null); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${shareMode === "password" ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Password
                    </button>
                  </div>
                </div>

                {/* Password input */}
                {shareMode === "password" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Password for viewers</label>
                    <input
                      type="password"
                      value={sharePassword}
                      onChange={(e) => setSharePassword(e.target.value)}
                      placeholder="Set a password"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}

                {/* Action button — disabled until mode is chosen */}
                <button
                  onClick={shareUrl ? handleCopyLink : handleCreateShare}
                  disabled={
                    shareLoading ||
                    (!shareUrl && shareMode === null) ||
                    (!shareUrl && shareMode === "password" && !sharePassword.trim())
                  }
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all"
                >
                  {shareLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : shareUrl ? (
                    <>
                      <Copy className="w-4 h-4" />
                      {shareCopied ? "Copied!" : "Copy link"}
                    </>
                  ) : shareMode === null ? (
                    <>
                      <Share2 className="w-4 h-4" />
                      Choose access type above
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      {shareMode === "password" ? "Create protected link" : "Create share link"}
                    </>
                  )}
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={open} onOpenChange={setOpen} >
            <PopoverTrigger asChild>
              <button className="flex items-center gap-[7px] rounded-[53px] px-4 py-[11px] text-sm font-semibold text-[#101323] md:px-[18px]"
                style={{
                  background: "linear-gradient(270deg, #D5CAFC 2.4%, #E3D2EB 27.88%, #F4DCD3 69.23%, #FDE4C2 100%)",
                }}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Export"} <ArrowRightFromLine className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(200px,calc(100vw-2rem))] space-y-2 rounded-[18px] p-0">
              <ExportOptions mobile={false} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  );
};

export default PresentationHeader;
