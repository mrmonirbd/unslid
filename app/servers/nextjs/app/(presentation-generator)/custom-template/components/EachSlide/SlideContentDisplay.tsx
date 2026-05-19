'use client'

import React from "react";

import SlideContent from "../SlideContent";
import { SlideContentDisplayProps } from "../../types";
import { Repeat2 } from "lucide-react";
import Timer from "../Timer";

export const SlideContentDisplay: React.FC<SlideContentDisplayProps> = ({
  slide,
  isEditMode,
  isHtmlEditMode,
  onHtmlChange,
  slideContentRef,
  slideDisplayRef,
  canvasRef,
  canvasDimensions,
  eraserMode,
  strokeWidth,
  strokeColor,
  isDrawing,
  didYourDraw,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  retrySlide,
  onEnterEditMode,
}) => {
  const focusEditableTextAtPoint = (clientX: number, clientY: number) => {
    if (typeof document === "undefined") return false;
    const editableText = document
      .elementsFromPoint(clientX, clientY)
      .find((element) => element.classList.contains("imported-editable-text")) as HTMLElement | undefined;

    if (!editableText) return false;

    editableText.focus();
    const documentWithCaret = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const pointRange =
      documentWithCaret.caretPositionFromPoint?.(clientX, clientY) ||
      documentWithCaret.caretRangeFromPoint?.(clientX, clientY);
    const range = document.createRange();

    if (pointRange && "offsetNode" in pointRange && pointRange.offsetNode) {
      range.setStart(pointRange.offsetNode, pointRange.offset);
    } else if (pointRange && "startContainer" in pointRange) {
      range.setStart(pointRange.startContainer, pointRange.startOffset);
    } else {
      range.selectNodeContents(editableText);
      range.collapse(false);
    }

    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return true;
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (focusEditableTextAtPoint(event.clientX, event.clientY)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onMouseDown(event);
  };

  const handleCanvasTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = event.touches[0];
    if (touch && focusEditableTextAtPoint(touch.clientX, touch.clientY)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onTouchStart(event);
  };

  // Don't show slide content when in HTML edit mode
  if (isHtmlEditMode) {
    return null;
  }

  if (slide.processing) {
    return (
      <div className="space-y-4">
        <p className="text-base text-blue-600 font-medium">Importing slide...</p>
        <div className="space-y-3">
          <Timer duration={160} />
        </div>
         <div className="animate-pulse space-y-3">
        <div className="h-6 bg-gray-200 rounded w-2/3"></div>
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
      </div>
    );
  }

  if (slide.processed && slide.html) {
    return (
      <div className="relative">
        {slide.convertingToReact && (
          <div className="mb-4">
            <p className="text-sm text-purple-700 font-medium mb-1">⚙️ Converting HTML to React...</p>
            <Timer duration={90} />
          </div>
        )}
        <div
          ref={slideDisplayRef}
          onClick={() => {
            if (!isEditMode && !isHtmlEditMode) {
              onEnterEditMode?.();
            }
          }}
          className={[
            "relative mx-auto w-full max-w-[1280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
            "[&_.imported-slide-canvas]:block [&_.imported-slide-canvas]:w-full [&_.imported-slide-canvas]:max-w-none [&_.imported-slide-canvas]:min-h-[240px] sm:[&_.imported-slide-canvas]:min-h-[360px] lg:[&_.imported-slide-canvas]:min-h-0",
            "[&_.imported-original-bg]:block [&_.imported-edit-bg]:block",
            "[&_.imported-editable-text]:box-border",
            !isEditMode
              ? "[&_.imported-editable-layer]:opacity-0 [&_.imported-editable-layer]:pointer-events-none [&_.imported-editable-text]:pointer-events-none [&_.imported-slide-canvas:focus-within_.imported-original-bg]:opacity-100 [&_.imported-slide-canvas:focus-within_.imported-edit-bg]:opacity-0 [&_.imported-slide-canvas:focus-within_.imported-editable-layer]:opacity-0"
              : "",
            slide.modified
              ? "[&_.imported-original-bg]:opacity-100 [&_.imported-edit-bg]:!opacity-0"
              : "",
            isEditMode
              ? "[&_.imported-original-bg]:opacity-0 [&_.imported-edit-bg]:opacity-100 [&_.imported-editable-layer]:z-40 [&_.imported-editable-layer]:opacity-100 [&_.imported-editable-layer]:pointer-events-auto [&_.imported-editable-text]:pointer-events-auto [&_.imported-editable-text]:cursor-text [&_.imported-editable-text]:rounded-sm [&_.imported-editable-text]:outline [&_.imported-editable-text]:outline-1 [&_.imported-editable-text]:outline-blue-400 [&_.imported-editable-text]:outline-offset-1 [&_.imported-editable-text]:transition-shadow [&_.imported-editable-text]:[text-size-adjust:100%] [&_.imported-editable-text]:[-webkit-text-size-adjust:100%] [&_.imported-editable-text:focus]:outline-2 [&_.imported-editable-text:focus]:outline-blue-500"
              : "",
          ].join(" ")}
        >
          <div
            ref={slideContentRef}
            className={isEditMode ? "relative z-40" : undefined}
            style={isEditMode ? { pointerEvents: "none" } : undefined}
          >
            <SlideContent slide={slide} onHtmlChange={onHtmlChange} />
          </div>
          {isEditMode && (
            <canvas
              ref={canvasRef}
              width={canvasDimensions.width}
              height={canvasDimensions.height}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 35,
                cursor: eraserMode ? "grab" : "crosshair",
                pointerEvents: "auto",
                touchAction: "none",
              }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
        </div>
      </div>
    );
  }

  if (slide.error) {
    return (
      <div className="space-y-4">
        <p className="text-base text-red-600 font-medium">Import failed</p>
        <div className="text-sm text-gray-700 p-4 bg-red-50 rounded border border-red-200">
          {slide.error.includes("image exceeds 5 MB maximum") ? (
            <div>
              <p className="font-medium text-red-700 mb-2">Image too large for processing</p>
              <p>This slide's image exceeds the 5MB limit. Try using a smaller resolution PPTX file.</p>
            </div>
          ) : (
            slide.error
          )}
        </div>
        <div className="flex justify-center">
          <button className="bg-red-50 flex gap-2 items-center rounded border border-red-200 px-4 py-2 " onClick={() => retrySlide(slide.slide_number)}>
            <Repeat2 className="w-4 h-4" />Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-base text-gray-500">⏳ Waiting in queue to process...</p>
      <div className="animate-pulse space-y-3">
        <div className="h-6 bg-gray-200 rounded w-2/3"></div>
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}; 
