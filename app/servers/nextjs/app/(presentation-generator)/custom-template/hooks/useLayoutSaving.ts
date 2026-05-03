import { useState, useCallback } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { ApiResponseHandler } from "@/app/(presentation-generator)/services/api/api-error-handler";
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

  const toJsStringLiteral = (value: string) =>
    JSON.stringify(
      value
        .replace(/contenteditable="true"/g, "")
        .replace(/contentEditable="true"/g, "")
    );

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
    className="relative h-full w-full overflow-hidden bg-white [&_.imported-slide-canvas]:h-full [&_.imported-slide-canvas]:w-full [&_.imported-slide-canvas]:max-w-none"
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
      await fetch("/api/v1/ppt/template-management/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: presentationId, name: layoutName, description }),
      });

      const saveResponse = await fetch(
        "/api/v1/ppt/template-management/save-templates",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            layouts: reactComponents,
          }),
        }
      );

      const data = await ApiResponseHandler.handleResponse(
        saveResponse,
        "Failed to save layout components"
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
