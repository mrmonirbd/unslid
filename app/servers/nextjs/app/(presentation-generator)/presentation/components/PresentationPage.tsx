"use client";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Skeleton } from "@/components/ui/skeleton";
import PresentationMode from "./PresentationMode";
import SidePanel from "./SidePanel";
import SlideContent from "./SlideContent";
import { Button } from "@/components/ui/button";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent, MixpanelEvent } from "@/utils/mixpanel";
import { AlertCircle } from "lucide-react";
import {
  usePresentationStreaming,
  usePresentationData,
  usePresentationNavigation,
  useAutoSave,
  useAutoSaveGeneratedTemplate,
} from "../hooks";
import { PresentationPageProps } from "../types";
import LoadingState from "./LoadingState";

import { usePresentationUndoRedo } from "../hooks/PresentationUndoRedo";
import PresentationHeader from "./PresentationHeader";
import { useCollaboration } from "../hooks/useCollaboration";
import ToolTip from "@/components/ToolTip";
import { loadFonts } from "../../hooks/useFontLoad";
import DashboardSidebar from "../../(dashboard)/Components/DashboardSidebar";
import { IframeAwareShell } from "../../(dashboard)/Components/IframeAwareShell";

const applyThemeToSlidesWrapper = (theme: any) => {
  const element = document.getElementById("presentation-slides-wrapper");
  if (!element) return;

  if (!theme?.data?.colors) {
    [
      "--primary-color",
      "--background-color",
      "--card-color",
      "--stroke",
      "--primary-text",
      "--background-text",
      "--graph-0",
      "--graph-1",
      "--graph-2",
      "--graph-3",
      "--graph-4",
      "--graph-5",
      "--graph-6",
      "--graph-7",
      "--graph-8",
      "--graph-9",
      "--heading-font-family",
      "--body-font-family",
    ].forEach((property) => element.style.removeProperty(property));
    element.style.removeProperty("font-family");
    return;
  }

  const colors = theme.data.colors;
  const cssVariables: Record<string, string | undefined> = {
    "--primary-color": colors.primary,
    "--background-color": colors.background,
    "--card-color": colors.card,
    "--stroke": colors.stroke,
    "--primary-text": colors.primary_text,
    "--background-text": colors.background_text,
    "--graph-0": colors.graph_0,
    "--graph-1": colors.graph_1,
    "--graph-2": colors.graph_2,
    "--graph-3": colors.graph_3,
    "--graph-4": colors.graph_4,
    "--graph-5": colors.graph_5,
    "--graph-6": colors.graph_6,
    "--graph-7": colors.graph_7,
    "--graph-8": colors.graph_8,
    "--graph-9": colors.graph_9,
  };

  Object.entries(cssVariables).forEach(([key, value]) => {
    if (value) element.style.setProperty(key, value);
  });

  const textFont = theme.data.fonts?.textFont;
  if (textFont?.name) {
    if (textFont.url) loadFonts({ [textFont.name]: textFont.url });
    element.style.setProperty("font-family", `"${textFont.name}"`);
    element.style.setProperty("--heading-font-family", `"${textFont.name}"`);
    element.style.setProperty("--body-font-family", `"${textFont.name}"`);
  }
};

const PresentationPage: React.FC<PresentationPageProps> = ({
  presentation_id,
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isIframe = searchParams.get("iframe") === "1";
  // State management
  const [loading, setLoading] = useState(true);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState(false);


  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  // Auto-save functionality
  const { isSaving } = useAutoSave({
    debounceMs: 2000,
    enabled: !!presentationData && !isStreaming,
  });

  // Custom hooks
  const { fetchUserSlides } = usePresentationData(
    presentation_id,
    setLoading,
    setError
  );

  const {
    isPresentMode,
    stream,
    handleSlideClick,
    toggleFullscreen,
    handlePresentExit,
    handleSlideChange,
  } = usePresentationNavigation(
    presentation_id,
    selectedSlide,
    setSelectedSlide,
    setIsFullscreen
  );

  useEffect(() => {
    applyThemeToSlidesWrapper(presentationData?.theme);
  }, [presentationData?.theme, loading, isPresentMode]);

  // Initialize streaming
  usePresentationStreaming(
    presentation_id,
    stream,
    setLoading,
    setError,
    fetchUserSlides
  );

  useAutoSaveGeneratedTemplate({
    presentationId: presentation_id,
    presentationData,
    isStreaming,
    loading,
  });

  usePresentationUndoRedo();

  // Real-time collaboration
  const { presence, myUserId } = useCollaboration(presentation_id, selectedSlide);
  const otherPresence = presence.filter((p) => p.user_id !== myUserId);

  const onSlideChange = (newSlide: number) => {
    handleSlideChange(newSlide, presentationData);
  };

  // useEffect(() => {
  //   if(!loading && !isStreaming && presentationData?.slides && presentationData?.slides.length > 0){  
  //     const presentation_id = presentationData?.slides[0].layout.split(":")[0].split("custom-")[1];
  //   const fonts = getCustomTemplateFonts(presentation_id);

  //   useFontLoader(fonts || []);
  // }
  // }, [presentationData,loading,isStreaming]);
  // Presentation Mode View
  if (isPresentMode) {
    return (
      <PresentationMode
        slides={presentationData?.slides!}
        currentSlide={selectedSlide}
        isFullscreen={isFullscreen}
        theme={presentationData?.theme}
        onFullscreenToggle={toggleFullscreen}
        onExit={handlePresentExit}
        onSlideChange={onSlideChange}
      />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 font-syne">
        <div
          className="bg-white border border-red-300 text-red-700 px-6 py-8 rounded-lg shadow-lg flex flex-col items-center"
          role="alert"
        >
          <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-center mb-4">
            We couldn't load your presentation. Please try again.
          </p>
          <Button onClick={() => { trackEvent(MixpanelEvent.PresentationPage_Refresh_Page_Button_Clicked, { pathname }); window.location.reload(); }}>Refresh Page</Button>
        </div>
      </div>
    );
  }

  return (
  <IframeAwareShell normalSidebar="none" showFooter={false} iframeContentClassName="min-h-0 flex-1 overflow-y-auto bg-white">
  <div className="min-h-dvh bg-white font-syne md:h-screen md:overflow-y-auto">
        <div
        style={{
          background: "#ffffff",
        }}
        className="relative flex min-h-dvh flex-col gap-0 md:h-screen md:min-h-0 md:flex-row md:gap-6"
      >
        {!isIframe && <DashboardSidebar />}
        <div className="w-full md:w-[200px] md:shrink-0">
          <SidePanel
            selectedSlide={selectedSlide}
            onSlideClick={handleSlideClick}
            presentationId={presentation_id}
            loading={loading}

          />
        </div>
        <div className="hide-scrollbar h-auto min-w-0 flex-1 overflow-y-auto px-3 pb-6 md:h-[calc(100vh-20px)] md:pr-[25px]">
          <div className="sticky top-0 z-50 bg-white">
            <PresentationHeader presentation_id={presentation_id} isPresentationSaving={isSaving} currentSlide={selectedSlide} />
            {/* Presence avatars — positioned inside the header row */}
            {otherPresence.length > 0 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center -space-x-2 z-50 pointer-events-none">
                {otherPresence.slice(0, 5).map((p) => (
                  <ToolTip key={p.user_id} content={`${p.name} — Slide ${p.slide_index + 1}`}>
                    <div
                      className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shrink-0 cursor-default pointer-events-auto"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  </ToolTip>
                ))}
                {otherPresence.length > 5 && (
                  <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-400 flex items-center justify-center text-white text-[10px] font-bold">
                    +{otherPresence.length - 5}
                  </div>
                )}
              </div>
            )}
          </div>
          <div
            id="presentation-slides-wrapper"
            style={{
              background: "rgba(255, 255, 255, 0.10)",
              boxShadow: "0 0 20.01px 0 rgba(122, 90, 248, 0.16) inset",
            }}
            className="flex flex-col items-center justify-center overflow-x-auto rounded-[20px] border border-[#EDECEC] p-3 sm:p-4 md:overflow-hidden md:p-6"
          >
            <div className="h-full w-full min-w-[620px] max-w-[1280px] md:min-w-0">

              {!presentationData ||
                loading ||
                !presentationData?.slides ||
                presentationData?.slides.length === 0 ? (
                <div className="relative w-full h-[calc(100vh-120px)]   mx-auto">
                  <div className="">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <Skeleton
                        key={index}
                        className="aspect-video bg-gray-400 my-4 w-full mx-auto "
                      />
                    ))}
                  </div>
                  {stream && <LoadingState />}
                </div>
              ) : (
                <>
                  {presentationData &&
                    presentationData.slides &&
                    presentationData.slides.length > 0 &&
                    presentationData.slides.map((slide: any, index: number) => (
                      <SlideContent
                        key={`${slide.id}-${index}-${slide.index}`}
                        slide={slide}
                        index={index}
                        presentationId={presentation_id}
                        theme={presentationData?.theme}
                      />
                    ))}
                </>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
  </IframeAwareShell>
  );
};

export default PresentationPage;
