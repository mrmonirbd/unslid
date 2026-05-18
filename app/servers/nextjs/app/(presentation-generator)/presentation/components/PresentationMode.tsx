"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Minimize2,
  Maximize2,
  StickyNote,
  EyeOff,
  Timer,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slide } from "../../types/slide";
import { V1ContentRender } from "../../components/V1ContentRender";
import { loadFonts } from "../../hooks/useFontLoad";

interface PresentationModeProps {
  slides: Slide[];
  currentSlide: number;
  isFullscreen: boolean;
  theme?: any;
  onFullscreenToggle: () => void;
  onExit: () => void;
  onSlideChange: (slideNumber: number) => void;
}

const ASPECT_RATIO_VALUES: Record<string, { css: string; value: number }> = {
  "16:9": { css: "16 / 9", value: 16 / 9 },
  "4:3": { css: "4 / 3", value: 4 / 3 },
  "9:16": { css: "9 / 16", value: 9 / 16 },
  "1:1": { css: "1 / 1", value: 1 },
  A4: { css: "1240 / 1754", value: 1240 / 1754 },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const getThemeStyles = (theme: any): React.CSSProperties => {
  const colors = theme?.data?.colors;
  const textFont = theme?.data?.fonts?.textFont;
  const styles: React.CSSProperties = {
    backgroundColor: "var(--page-background-color,#c8c7c9)",
  };

  if (colors) {
    Object.assign(styles, {
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
    });
  }

  if (textFont?.name) {
    Object.assign(styles, {
      fontFamily: `"${textFont.name}"`,
      "--heading-font-family": `"${textFont.name}"`,
      "--body-font-family": `"${textFont.name}"`,
    });
  }

  return styles;
};

const PresentationMode: React.FC<PresentationModeProps> = ({
  slides,
  currentSlide,
  isFullscreen,
  theme,
  onFullscreenToggle,
  onExit,
  onSlideChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(true);
  const [showPresenterPanel, setShowPresenterPanel] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentSpeakerNote = useMemo(
    () => slides[currentSlide]?.speaker_note?.trim() || "",
    [slides, currentSlide]
  );
  const nextSlide = slides[currentSlide + 1] ?? null;
  const progress = slides.length > 1 ? (currentSlide / (slides.length - 1)) * 100 : 100;
  const aspectRatio = ASPECT_RATIO_VALUES[theme?.aspect_ratio || "16:9"] || ASPECT_RATIO_VALUES["16:9"];

  useEffect(() => {
    const textFont = theme?.data?.fonts?.textFont;
    if (textFont?.name && textFont?.url) {
      loadFonts({ [textFont.name]: textFont.url });
    }
  }, [theme]);

  // Timer
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  // Keyboard shortcuts
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
          if (currentSlide < slides.length - 1) onSlideChange(currentSlide + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          if (currentSlide > 0) onSlideChange(currentSlide - 1);
          break;
        case "Escape":
          if (document.fullscreenElement) {
            try { document.exitFullscreen(); } catch (_) {}
            return;
          }
          onExit();
          break;
        case "f":
        case "F":
          onFullscreenToggle();
          break;
        case "n":
        case "N":
          setShowSpeakerNotes((prev) => !prev);
          break;
        case "p":
        case "P":
          setShowPresenterPanel((prev) => !prev);
          break;
        case "t":
        case "T":
          setTimerRunning((prev) => !prev);
          break;
      }
    },
    [currentSlide, slides.length, onSlideChange, onExit, onFullscreenToggle]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
      }
      handleKeyPress(e);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyPress]);

  const handleSlideClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".presentation-controls")) return;
    const clickX = e.clientX;
    const w = window.innerWidth;
    if (clickX < w / 3) {
      if (currentSlide > 0) onSlideChange(currentSlide - 1);
    } else if (clickX > (w * 2) / 3) {
      if (currentSlide < slides.length - 1) onSlideChange(currentSlide + 1);
    }
  };

  if (!slides || slides.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col"
      style={getThemeStyles(theme)}
      tabIndex={0}
      onClick={handleSlideClick}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 z-50 bg-black/10">
        <div
          className="h-full bg-gradient-to-r from-[#9034EA] to-[#5146E5] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Top controls */}
      <div className="presentation-controls absolute top-3 right-4 flex items-center gap-2 z-50">
        {/* Timer display */}
        <div
          className="flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5 text-sm font-mono text-white backdrop-blur-sm cursor-pointer select-none"
          onClick={(e) => { e.stopPropagation(); setTimerRunning((p) => !p); }}
          title="Click to pause/resume timer (T)"
        >
          <Timer className="h-3.5 w-3.5" />
          {formatTime(elapsed)}
        </div>
        <Button
          variant="ghost"
          size="icon"
          title="Reset timer"
          onClick={(e) => { e.stopPropagation(); setElapsed(0); setTimerRunning(true); }}
          className="h-8 w-8 rounded-full bg-black/20 text-white hover:bg-black/30"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        {/* Presenter panel toggle */}
        <Button
          variant="ghost"
          size="icon"
          title="Toggle presenter panel (P)"
          onClick={(e) => { e.stopPropagation(); setShowPresenterPanel((p) => !p); }}
          className={`h-8 w-8 rounded-full text-white hover:bg-black/30 ${showPresenterPanel ? "bg-purple-600/70" : "bg-black/20"}`}
        >
          <StickyNote className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
          onClick={(e) => { e.stopPropagation(); onFullscreenToggle(); }}
          className="h-8 w-8 rounded-full bg-black/20 text-white hover:bg-black/30"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Exit presentation (Esc)"
          onClick={(e) => { e.stopPropagation(); onExit(); }}
          className="h-8 w-8 rounded-full bg-black/20 text-white hover:bg-black/30"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Main content area */}
      {showPresenterPanel ? (
        /* Presenter view: current slide left, notes + next slide right */
        <div className="flex-1 min-h-0 flex flex-row gap-4 p-4 pt-10">
          {/* Current slide (2/3 width) */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <div
              className="relative rounded-sm font-inter w-full"
              style={{ aspectRatio: "16/9" }}
            >
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={index === currentSlide ? "h-full w-full" : "hidden h-full w-full"}
                >
                  <V1ContentRender slide={slide} isEditMode={false} theme={theme} />
                </div>
              ))}
            </div>
          </div>

          {/* Right panel: next slide + notes */}
          <div className="w-72 flex flex-col gap-3 shrink-0">
            {/* Slide counter + timer */}
            <div className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 text-white">
              <span className="text-sm font-medium">
                {currentSlide + 1} / {slides.length}
              </span>
              <span className="font-mono text-sm">{formatTime(elapsed)}</span>
            </div>

            {/* Next slide preview */}
            {nextSlide && (
              <div className="rounded-xl bg-black/20 p-2">
                <p className="mb-1.5 text-xs font-medium text-white/70">Next slide</p>
                <div
                  className="relative w-full overflow-hidden rounded"
                  style={{ aspectRatio: "16/9" }}
                >
                  <V1ContentRender slide={nextSlide} isEditMode={false} theme={theme} />
                  <div className="absolute inset-0" />
                </div>
              </div>
            )}

            {/* Speaker notes */}
            <div className="flex-1 min-h-0 overflow-auto rounded-xl bg-white/90 p-3">
              <p className="mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Speaker notes</p>
              <p className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                {currentSpeakerNote || "No notes for this slide."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Standard full-screen slide view */
        <div className={`flex-1 min-h-0 flex items-center justify-center ${isFullscreen ? "p-0" : "p-8"}`}>
          <div
            className={`relative font-inter ${isFullscreen ? "presentation-slide-fullscreen h-screen w-screen overflow-hidden" : "rounded-sm"}`}
            style={{
              aspectRatio: isFullscreen ? undefined : aspectRatio.css,
              width: isFullscreen ? "100vw" : `min(calc(100vw - 4rem), calc((100vh - 4rem) * ${aspectRatio.value}))`,
              height: isFullscreen ? "100vh" : undefined,
              maxHeight: isFullscreen ? "100vh" : "calc(100vh - 4rem)",
            }}
          >
            {isFullscreen && (
              <style>
                {`
                  .presentation-slide-fullscreen > div > div > * {
                    width: 100% !important;
                    height: 100% !important;
                    max-width: none !important;
                    max-height: none !important;
                    aspect-ratio: auto !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                  }
                `}
              </style>
            )}
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={index === currentSlide ? "h-full w-full" : "hidden h-full w-full"}
              >
                <V1ContentRender slide={slide} isEditMode={false} theme={theme} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <div className="presentation-controls absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); if (currentSlide > 0) onSlideChange(currentSlide - 1); }}
          disabled={currentSlide === 0}
          className="h-8 w-8 rounded-full bg-black/20 text-white hover:bg-black/30 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="min-w-[60px] text-center text-sm font-medium text-white bg-black/20 rounded-full px-3 py-1 backdrop-blur-sm">
          {currentSlide + 1} / {slides.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); if (currentSlide < slides.length - 1) onSlideChange(currentSlide + 1); }}
          disabled={currentSlide === slides.length - 1}
          className="h-8 w-8 rounded-full bg-black/20 text-white hover:bg-black/30 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Floating speaker notes (standard view only) */}
      {!isFullscreen && !showPresenterPanel && currentSpeakerNote && (
        <div className="presentation-controls absolute bottom-4 right-4 z-50">
          {showSpeakerNotes ? (
            <div className="w-[360px] max-w-[50vw] rounded-xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-black/10 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <StickyNote className="h-4 w-4" />
                  Speaker notes
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setShowSpeakerNotes(false); }}
                  className="h-8 px-2 text-gray-600 hover:bg-black/5 hover:text-gray-800"
                >
                  <EyeOff className="mr-1 h-4 w-4" />
                  Hide
                </Button>
              </div>
              <div className="max-h-[28vh] overflow-auto whitespace-pre-wrap px-3 py-2 text-sm text-gray-700">
                {currentSpeakerNote}
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); setShowSpeakerNotes(true); }}
              className="h-9 rounded-full border border-black/10 bg-white/95 px-3 text-gray-800 shadow-md hover:bg-white"
            >
              <StickyNote className="mr-2 h-4 w-4" />
              Show notes (N)
            </Button>
          )}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="presentation-controls absolute bottom-4 left-4 z-50">
        <div className="text-xs text-white/50 space-x-3 hidden md:flex">
          <span>← → Navigate</span>
          <span>N Notes</span>
          <span>P Presenter</span>
          <span>T Timer</span>
          <span>F Fullscreen</span>
        </div>
      </div>
    </div>
  );
};

export default PresentationMode;
