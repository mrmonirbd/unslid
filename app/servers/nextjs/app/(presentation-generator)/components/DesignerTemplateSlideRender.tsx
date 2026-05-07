"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/auth/client";
import { useDispatch } from "react-redux";
import { updateSlideContent } from "@/store/slices/presentationGeneration";
import ImageEditor from "./ImageEditor";

interface DesignerBox {
  left_pct: number;
  top_pct: number;
  width_pct: number;
  height_pct: number;
}

interface SelectableTextBox extends DesignerBox {
  text: string;
  font_size_pt?: number | null;
}

interface SelectableDesignerSlide {
  slide_number: number;
  thumbnail_url: string | null;
  background_thumbnail_url?: string | null;
  text_boxes: SelectableTextBox[];
  image_boxes?: DesignerBox[];
}

interface SelectableDesignerPreview {
  id: number;
  name: string;
  slide_count: number;
  slides: SelectableDesignerSlide[];
}

const previewCache = new Map<number, Promise<SelectableDesignerPreview>>();

const getDesignerPreview = (templateId: number) => {
  if (!previewCache.has(templateId)) {
    previewCache.set(
      templateId,
      api.get<SelectableDesignerPreview>(`/api/v1/account/pptx-templates/${templateId}/selectable-preview`)
    );
  }
  return previewCache.get(templateId)!;
};

const isUsefulString = (key: string, value: string) => {
  const normalizedKey = key.toLowerCase();
  if (!value.trim()) return false;
  if (normalizedKey.startsWith("__")) return false;
  if (["url", "image", "icon", "color", "font", "prompt"].some((blocked) => normalizedKey.includes(blocked))) return false;
  return true;
};

const flattenGeneratedText = (value: unknown, parentKey = ""): string[] => {
  if (typeof value === "string") {
    return isUsefulString(parentKey, value) ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenGeneratedText(item, `${parentKey}.${index}`));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const priority = ["title", "subtitle", "heading", "description", "summary", "insight", "label", "value"];
    return entries
      .sort(([a], [b]) => {
        const ai = priority.findIndex((key) => a.toLowerCase().includes(key));
        const bi = priority.findIndex((key) => b.toLowerCase().includes(key));
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
      .flatMap(([key, child]) => flattenGeneratedText(child, key));
  }
  return [];
};

const toDesignerText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toDesignerText).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    const nested = (value as Record<string, unknown>).__designer_text_boxes__;
    if (nested !== undefined) return toDesignerText(nested);
    return flattenGeneratedText(value).map(toDesignerText).filter(Boolean).join("\n");
  }
  return "";
};

const getDesignerPromptText = (value: unknown): string[] => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const designerText = (value as Record<string, unknown>).__designer_text_boxes__;
    if (designerText !== undefined) {
      return Array.isArray(designerText)
        ? designerText.map(toDesignerText).filter(Boolean)
        : [toDesignerText(designerText)].filter(Boolean);
    }
  }
  return flattenGeneratedText(value);
};

const DesignerTemplateSlideRender = ({
  templateId,
  slideIndex,
  slideContent,
}: {
  templateId: number;
  slideIndex: number;
  slideContent?: Record<string, unknown>;
}) => {
  const dispatch = useDispatch();
  const [preview, setPreview] = useState<SelectableDesignerPreview | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getDesignerPreview(templateId)
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch(() => {
        if (active) setPreview(null);
      });

    return () => {
      active = false;
    };
  }, [templateId]);

  const slides = preview?.slides ?? [];
  const slide = slides[slideIndex] ?? slides[slideIndex % Math.max(slides.length, 1)];

  useEffect(() => {
    const sourceUrl = slide?.background_thumbnail_url || slide?.thumbnail_url;
    if (!sourceUrl) {
      setImageSrc(null);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;
    const authClient = createClient();

    authClient.auth.getSession()
      .then(async ({ data: { session } }) => {
        const response = await fetch(sourceUrl, {
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : undefined,
        });
        if (!response.ok) throw new Error("Failed to load thumbnail");
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setImageSrc(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => {
        if (active) setImageSrc(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [slide?.background_thumbnail_url, slide?.thumbnail_url]);

  const savedTexts = Array.isArray(slideContent?.__designer_text_boxes__)
    ? slideContent.__designer_text_boxes__ as unknown[]
    : null;
  const generatedTexts = savedTexts ?? flattenGeneratedText(slideContent ?? {});
  const getBoxText = (box: SelectableTextBox, index: number) =>
    toDesignerText(generatedTexts[index] ?? box.text) || box.text;
  const savedImages = (slideContent?.__designer_images__ ?? {}) as Record<string, { src?: string }>;
  const imagePrompt = getDesignerPromptText(slideContent ?? {}).join(" ").slice(0, 220);

  const handleDesignerImageChange = (index: number, imageUrl: string) => {
    dispatch(updateSlideContent({
      slideIndex,
      dataPath: `__designer_images__.${index}.src`,
      content: imageUrl,
    }));
    setActiveImageIndex(null);
  };

  if (!imageSrc) {
    return (
      <div data-slide-content="true" className="flex aspect-video h-full w-full items-center justify-center bg-[#F3F4F6] text-sm text-gray-500">
        Designer template preview is loading
      </div>
    );
  }

  return (
    <div data-slide-content="true" className="relative aspect-video h-full w-full overflow-hidden bg-white">
      <img
        src={imageSrc}
        alt={`Designer template slide ${slide.slide_number}`}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {(slide.image_boxes ?? []).map((box, index) => {
        const replacementSrc = savedImages[index]?.src;
        return (
          <div
            key={`${slide.slide_number}-image-${index}`}
            className="group absolute z-20 cursor-pointer overflow-hidden outline outline-0 transition hover:outline hover:outline-2 hover:outline-[#5141e5]"
            onClick={() => setActiveImageIndex(index)}
            style={{
              left: `${box.left_pct}%`,
              top: `${box.top_pct}%`,
              width: `${box.width_pct}%`,
              height: `${box.height_pct}%`,
            }}
          >
            {replacementSrc && (
              <img
                src={replacementSrc}
                alt={`Replacement image ${index + 1}`}
                className="h-full w-full object-cover"
                draggable={false}
              />
            )}
            <div className="absolute inset-0 hidden items-center justify-center bg-black/25 group-hover:flex">
              <span className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-900 shadow">
                Change image
              </span>
            </div>
          </div>
        );
      })}
      {slide.text_boxes.map((box, index) => (
        <div
          key={`${slide.slide_number}-${index}`}
          className="absolute z-10 overflow-hidden whitespace-pre-wrap outline-none selection:bg-[#CBD2FF]/80"
          contentEditable
          suppressContentEditableWarning
          onBlur={(event) => {
            dispatch(updateSlideContent({
              slideIndex,
              dataPath: `__designer_text_boxes__.${index}`,
              content: event.currentTarget.textContent ?? "",
            }));
          }}
          style={{
            left: `${box.left_pct}%`,
            top: `${box.top_pct}%`,
            width: `${box.width_pct}%`,
            height: `${box.height_pct}%`,
            fontSize: `${Math.max((box.font_size_pt ?? 12) * 1.333, 8)}px`,
            lineHeight: 1.15,
            color: "#263B3C",
            fontFamily: "Poppins, Arial, sans-serif",
            fontWeight: index === 0 ? 700 : 400,
            userSelect: "text",
          }}
        >
          {getBoxText(box, index)}
        </div>
      ))}
      {activeImageIndex !== null && (
        <ImageEditor
          initialImage={savedImages[activeImageIndex]?.src || imageSrc}
          slideIndex={slideIndex}
          promptContent={imagePrompt}
          imageIdx={activeImageIndex}
          properties={null}
          onClose={() => setActiveImageIndex(null)}
          onImageChange={(newImageUrl) => handleDesignerImageChange(activeImageIndex, newImageUrl)}
        />
      )}
    </div>
  );
};

export default DesignerTemplateSlideRender;
