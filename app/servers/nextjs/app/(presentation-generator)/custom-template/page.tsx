"use client";

import React, { useEffect } from "react";
import FontManager from "./components/FontManager";
import DashboardSidebar from "../(dashboard)/Components/DashboardSidebar";

import { useCustomLayout } from "./hooks/useCustomLayout";
import { useFontManagement } from "./hooks/useFontManagement";
import { useFileUpload } from "./hooks/useFileUpload";
import { useSlideProcessing } from "./hooks/useSlideProcessing";
import { useLayoutSaving } from "./hooks/useLayoutSaving";
import { useRouter } from "next/navigation";
import { FileUploadSection } from "./components/FileUploadSection";
import { SaveLayoutButton } from "./components/SaveLayoutButton";
import { SaveLayoutModal } from "./components/SaveLayoutModal";
import EachSlide from "./components/EachSlide/NewEachSlide";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { useUser } from "@/app/hooks/useUser";
import { CheckCircle2, FileText, LayoutPanelLeft, UploadCloud } from "lucide-react";
import CommonFooter from "@/components/CommonFooter";

const CustomTemplatePage = () => {
  const router = useRouter();
  const { user } = useUser();
  const isAdmin = !!user?.is_admin;


  // Custom hooks for different concerns
  const { slides, setSlides, completedSlides } = useCustomLayout();
  const { fontsData, UploadedFonts, uploadFont, removeFont, getAllUnsupportedFonts, setFontsData } = useFontManagement();
  const { selectedFile, handleFileSelect, selectFile, removeFile } = useFileUpload(() => {
    setSlides([]);
    setFontsData(null);
  });
  const { isProcessingPptx, processFile, retrySlide, processSlideToHtml } = useSlideProcessing(
    selectedFile,
    slides,
    setSlides,
    setFontsData
  );
  const { isSavingLayout, isModalOpen, openSaveModal, closeSaveModal, saveLayout } = useLayoutSaving(
    slides,
    UploadedFonts,
    fontsData,

    setSlides
  );

  const handleSaveTemplate = async (layoutName: string, description: string): Promise<string | null> => {
    trackEvent(MixpanelEvent.CustomTemplate_Save_Templates_API_Call);
    const id = await saveLayout(layoutName, description);
    if (id) {
      router.push(`/template-preview/custom-${id}`);
    }
    return id;
  };

  const handleProcessSlideToHtml = (slide: any) => {
    processSlideToHtml(slide, 0)
  }

  // Handle slide updates
  const handleSlideUpdate = (index: number, updatedSlideData: any) => {
    setSlides((prevSlides) =>
      prevSlides.map((s, i) =>
        i === index
          ? {
            ...s,
            ...updatedSlideData,
            modified: true,
          }
          : s
      )
    );
  };
  useEffect(() => {
    const existingScript = document.querySelector(
      'script[src*="tailwindcss.com"]'
    );
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#fbf9ff] text-slate-950 md:flex-row">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_32%),linear-gradient(180deg,#fbf9ff_0%,#ffffff_48%,#f8fafc_100%)] md:h-screen">
        <div className="min-h-full px-4 pb-24 font-syne sm:px-6 md:px-8 md:pb-12">
          <div className="pt-8 pb-6">
            <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Create custom template
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Import a PDF or PowerPoint deck and save it as a reusable presentation design.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm sm:px-4">
                  <UploadCloud className="h-4 w-4 text-violet-500" />
                  {selectedFile ? "File ready" : "Upload file"}
                </div>
                <div className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 shadow-sm sm:px-4">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {completedSlides}/{slides.length || 0} done
                </div>
              </div>
            </div>

            <div className="mt-6 grid max-w-3xl grid-cols-1 gap-3 min-[520px]:grid-cols-3 sm:gap-4">
              <div className="rounded-xl border border-violet-100 bg-white/95 px-4 py-3 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-violet-500" />
                  <span className="text-xs font-medium text-slate-500">Source</span>
                </div>
                <p className="truncate text-lg font-bold text-slate-900">
                  {selectedFile ? selectedFile.name : "No file"}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">PDF or PPTX</p>
              </div>

              <div className="rounded-xl border border-violet-100 bg-white/95 px-4 py-3 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <LayoutPanelLeft className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium text-slate-500">Slides</span>
                </div>
                <p className="text-lg font-bold text-slate-900">{slides.length || "None"}</p>
                <p className="mt-0.5 text-xs text-slate-400">imported layouts</p>
              </div>

              <div className="rounded-xl border border-violet-100 bg-white/95 px-4 py-3 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-500" />
                  <span className="text-xs font-medium text-slate-500">Status</span>
                </div>
                <p className="text-lg font-bold text-slate-900">
                  {isProcessingPptx || slides.some((s) => s.processing) ? "Processing" : slides.length ? "Ready" : "Waiting"}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">template extraction</p>
              </div>
            </div>
          </div>

          <div className="mb-6 border-t border-slate-200" />

          <FileUploadSection
            selectedFile={selectedFile}
            handleFileSelect={handleFileSelect}
            selectFile={selectFile}
            removeFile={removeFile}
            processFile={processFile}
            isProcessingPptx={isProcessingPptx}
            slides={slides}
            completedSlides={completedSlides}
          />

          {fontsData && (
            <FontManager
              fontsData={fontsData}
              UploadedFonts={UploadedFonts}
              uploadFont={uploadFont}
              removeFont={removeFont}
              getAllUnsupportedFonts={getAllUnsupportedFonts}
              processSlideToHtml={() => handleProcessSlideToHtml(slides[0])}
            />
          )}

          {slides.length > 0 && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Imported slides</h2>
                <span className="text-xs text-slate-400">{slides.length} total</span>
              </div>
              <div className="space-y-6">
                {slides.map((slide, index) => (
                  <EachSlide
                    key={index}
                    slide={slide}
                    index={index}
                    isProcessing={slides.some((s) => s.processing)}
                    retrySlide={retrySlide}
                    setSlides={setSlides}
                    canEditHtml={isAdmin}
                    onSlideUpdate={(updatedSlideData) =>
                      handleSlideUpdate(index, updatedSlideData)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {slides.length > 0 && slides.some((s) => s.processed) && (
            <SaveLayoutButton
              onSave={openSaveModal}
              isSaving={isSavingLayout}
              isProcessing={slides.some((s) => s.processing)}
            />
          )}

          <SaveLayoutModal
            isOpen={isModalOpen}
            onClose={closeSaveModal}
            onSave={handleSaveTemplate}
            isSaving={isSavingLayout}
          />
        </div>
        <CommonFooter />
      </div>
      <DashboardSidebar />
    </div>
  );
};

export default CustomTemplatePage;
