import { useState, useCallback } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { api } from "@/lib/api";
import { ProcessedSlide, UploadedFont, FontData } from "../types";

export const useLayoutSaving = (
  slides: ProcessedSlide[],
  UploadedFonts: UploadedFont[],
  fontsData: FontData | null,
  // refetch: () => void,
  setSlides: React.Dispatch<React.SetStateAction<ProcessedSlide[]>>
) => {
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openSaveModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeSaveModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const bakeEditableImportedHtml = (value: string) => {
    if (typeof document === "undefined") {
      return value
        .replace(/contenteditable="true"/g, "")
        .replace(/contentEditable="true"/g, "");
    }

    const container = document.createElement("div");
    container.innerHTML = value;

    container.querySelectorAll<HTMLElement>(".imported-slide-canvas").forEach((canvas) => {
      const hasEditableText = canvas.getAttribute("data-editable-text") === "true";
      if (!hasEditableText) return;

      const originalBg = canvas.querySelector<HTMLElement>(".imported-original-bg");
      const editBg = canvas.querySelector<HTMLElement>(".imported-edit-bg");
      const editableLayer = canvas.querySelector<HTMLElement>(".imported-editable-layer");

      if (originalBg) originalBg.style.opacity = "0";
      if (editBg) editBg.style.opacity = "1";
      if (editableLayer) {
        editableLayer.style.opacity = "1";
        editableLayer.style.pointerEvents = "none";
      }

      canvas.querySelectorAll<HTMLElement>("[contenteditable]").forEach((node) => {
        node.removeAttribute("contenteditable");
        node.removeAttribute("contentEditable");
        node.style.pointerEvents = "none";
        node.style.outline = "none";
      });
    });

    return container.innerHTML;
  };

  const toJsStringLiteral = (value: string) =>
    JSON.stringify(bakeEditableImportedHtml(value));

  const convertSlideToReact = async (slide: ProcessedSlide, presentationId: string, FontUrls: string[]) => {
    const importedHtml = toJsStringLiteral(slide.html || "");
    const slideNumber = Number(slide.slide_number) || 1;
    const layoutCode = `
const layoutId = "${slideNumber}";
const layoutName = "Slide${slideNumber}";
const layoutDescription = "Editable imported slide ${slideNumber}";
const Schema = z.object({});
const importedHtml = ${importedHtml};

const dynamicSlideLayout = () => (
  <div
    className="relative h-full w-full overflow-hidden bg-white [&_.imported-slide-canvas]:h-full [&_.imported-slide-canvas]:w-full [&_.imported-slide-canvas]:max-w-none [&_.imported-editable-layer]:pointer-events-none"
    dangerouslySetInnerHTML={{ __html: importedHtml }}
  />
);
`;

    return {
      presentation: presentationId,
      layout_id: `${slide.slide_number}`,
      layout_name: `Slide${slide.slide_number}`,
      layout_code: layoutCode,
      fonts: FontUrls,
    };
  };

  const saveLayout = useCallback(async (layoutName: string, description: string): Promise<string | null> => {
    if (!slides.length) {
      toast.error("No slides to save");
      return null;
    }

    setIsSavingLayout(true);

    try {
      // Save each imported slide as editable HTML/React. This import path does
      // not call AI; PPTX text boxes are extracted from slide XML.
      const reactComponents: any[] = [];
      const presentationId = uuidv4();

      // Collect uploaded font URLs and Google Fonts CSS URLs
      const uploadedFontUrls = UploadedFonts.map((font) => font.fontUrl);
      const googleFontCssUrls = fontsData?.internally_supported_fonts?.map(f => f.google_fonts_url).filter(Boolean) || [];
      const FontUrls = Array.from(new Set([...(uploadedFontUrls || []), ...googleFontCssUrls]));

      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];

        if (!slide.html) {
          toast.error(`Slide ${slide.slide_number} has no HTML content`);
          continue;
        }

        // Mark current slide as converting to React
        setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, convertingToReact: true } : s));

        try {
          const reactComponent = await convertSlideToReact(slide, presentationId, FontUrls);
          reactComponents.push(reactComponent);

          // Update progress
          toast.success(`Prepared slide ${slide.slide_number}`);
        } catch (error) {
          console.error(`Error converting slide ${slide.slide_number}:`, error);
          toast.error(`Failed to prepare slide ${slide.slide_number}`, {
            description:
              error instanceof Error
                ? error.message
                : "An unexpected error occurred",
          });
          // Continue with other slides even if one fails
        } finally {
          // Clear converting flag for this slide
          setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, convertingToReact: false } : s));
        }
      }

      if (reactComponents.length === 0) {
        toast.error("No slides were successfully converted");
        return null;
      }

      // First create/update the template metadata
      await api.post("/api/v1/ppt/template-management/templates", {
        id: presentationId,
        name: layoutName,
        description,
      });

      const data = await api.post<any>(
        "/api/v1/ppt/template-management/save-templates",
        { layouts: reactComponents }
      );

      if (!data.success) {
        toast.error("Failed to save layout components");
        return null;
      }

      toast.success("Layout saved successfully");

      // Mark all slides as saved (remove modified flag)
      slides.forEach((slide) => {
        slide.modified = false;
      });

      toast.success(`Layout "${layoutName}" saved successfully`);
      // refetch();
      closeSaveModal();
      return presentationId;
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error("Failed to save layout", {
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      });
      return null;
    } finally {
      setIsSavingLayout(false);
    }
  }, [slides, UploadedFonts, fontsData, closeSaveModal, setSlides]);

  return {
    isSavingLayout,
    isModalOpen,
    openSaveModal,
    closeSaveModal,
    saveLayout,
  };
}; 
