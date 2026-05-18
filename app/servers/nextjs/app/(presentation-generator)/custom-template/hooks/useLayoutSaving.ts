import { useState, useCallback } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { api } from "@/lib/api";
import { ProcessedSlide, UploadedFont, FontData } from "../types";

type TextToken = {
  key: string;
  value: string;
};

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

  const bakeEditableImportedHtml = (value: string, preserveOriginalVisual = false) => {
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

      if (originalBg) originalBg.style.opacity = preserveOriginalVisual ? "1" : "0";
      if (editBg) editBg.style.opacity = preserveOriginalVisual ? "0" : "1";
      if (editableLayer) {
        editableLayer.style.opacity = preserveOriginalVisual ? "0" : "1";
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

  const tokenizeImportedHtml = (slide: ProcessedSlide): { html: string; textTokens: TextToken[] } => {
    const html = slide.html || "";
    if (typeof document === "undefined") {
      return { html: bakeEditableImportedHtml(html, !slide.modified), textTokens: [] };
    }

    const container = document.createElement("div");
    container.innerHTML = html;
    const textTokens: TextToken[] = [];

    container.querySelectorAll<HTMLElement>(".imported-slide-canvas").forEach((canvas) => {
      const editableTextNodes = Array.from(canvas.querySelectorAll<HTMLElement>(".imported-editable-text"))
        .filter((node) => (node.textContent || "").replace(/\s+/g, " ").trim().length > 0);
      const hasEditableText = canvas.getAttribute("data-editable-text") === "true" && editableTextNodes.length > 0;

      const originalBg = canvas.querySelector<HTMLElement>(".imported-original-bg");
      const editBg = canvas.querySelector<HTMLElement>(".imported-edit-bg");
      const editableLayer = canvas.querySelector<HTMLElement>(".imported-editable-layer");

      if (hasEditableText) {
        if (originalBg) originalBg.style.opacity = "0";
        if (editBg) editBg.style.opacity = "1";
        if (editableLayer) {
          editableLayer.style.opacity = "1";
          editableLayer.style.pointerEvents = "none";
        }
      } else {
        if (originalBg) originalBg.style.opacity = "1";
        if (editBg) editBg.style.opacity = "0";
        if (editableLayer) {
          editableLayer.style.opacity = "0";
          editableLayer.style.pointerEvents = "none";
        }
      }

      editableTextNodes.slice(0, 80).forEach((node) => {
        const value = (node.textContent || "").replace(/\s+/g, " ").trim();
        if (!value) return;

        const key = `text_${textTokens.length + 1}`;
        textTokens.push({ key, value });
        node.setAttribute("data-ai-text-key", key);
        node.textContent = `{{${key}}}`;
        node.removeAttribute("contenteditable");
        node.removeAttribute("contentEditable");
        node.style.pointerEvents = "none";
        node.style.outline = "none";
      });
    });

    return { html: container.innerHTML, textTokens };
  };

  const buildDynamicImportedLayoutCode = (slide: ProcessedSlide, slideNumber: number) => {
    const { html: tokenizedHtml, textTokens } = tokenizeImportedHtml(slide);
    const textSchemaFields = textTokens.map((token) => (
      `${JSON.stringify(token.key)}: z.string().max(260).describe(${JSON.stringify(`Visible template text currently reading: "${token.value.slice(0, 140)}". Rewrite this text for the user's prompt while preserving the slide's role and length.`)}).default(${JSON.stringify(token.value)})`
    ));

    return `
const layoutId = "${slideNumber}";
const layoutName = "Slide${slideNumber}";
const layoutDescription = "Editable imported slide ${slideNumber}";
const Schema = z.object({
  ${textSchemaFields.join(",\n  ")}
});
const generatedSlideHtml = ${JSON.stringify(tokenizedHtml)};
const textTokenKeys = ${JSON.stringify(textTokens.map((token) => token.key))};
const textTokenDefaults = ${JSON.stringify(Object.fromEntries(textTokens.map((token) => [token.key, token.value])))};

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const dynamicSlideLayout = ({ data = {} }) => {
  const html = textTokenKeys.reduce((nextHtml, key) => (
    nextHtml.split("{{" + key + "}}").join(escapeHtml(data[key] ?? textTokenDefaults[key] ?? ""))
  ), generatedSlideHtml);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-white [&_.imported-slide-canvas]:h-full [&_.imported-slide-canvas]:w-full [&_.imported-slide-canvas]:max-w-none [&_.imported-editable-layer]:pointer-events-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
`;
  };

  const convertSlideToReact = async (slide: ProcessedSlide, presentationId: string, FontUrls: string[]) => {
    const slideNumber = Number(slide.slide_number) || 1;
    const layoutCode = buildDynamicImportedLayoutCode(slide, slideNumber);

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
