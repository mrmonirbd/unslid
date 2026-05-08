import { getHeader, getHeaderForFormData } from "./header";
import { IconSearch, ImageGenerate, ImageSearch, PreviousGeneratedImagesResponse } from "./params";
import { ApiResponseHandler } from "./api-error-handler";

function normalizeExportModel<T>(presentationData: T): T {
  if (!presentationData || typeof presentationData !== "object") {
    return presentationData;
  }

  const normalizeShape = (shape: any) => {
    if (!shape || typeof shape !== "object") return;

    if (typeof shape.border_radius === "number") {
      shape.border_radius = Math.round(shape.border_radius);
    } else if (Array.isArray(shape.border_radius)) {
      shape.border_radius = shape.border_radius.map((radius: unknown) =>
        typeof radius === "number" ? Math.round(radius) : radius
      );
    }
  };

  const normalized: any = structuredClone(presentationData);
  if (Array.isArray(normalized.shapes)) {
    normalized.shapes.forEach(normalizeShape);
  }
  if (Array.isArray(normalized.slides)) {
    normalized.slides.forEach((slide: any) => {
      if (Array.isArray(slide?.shapes)) {
        slide.shapes.forEach(normalizeShape);
      }
    });
  }

  return normalized;
}

export class PresentationGenerationApi {
  static async uploadDoc(documents: File[]) {
    const formData = new FormData();

    documents.forEach((document) => {
      formData.append("files", document);
    });

    try {
      const response = await fetch(
        `/api/v1/ppt/files/upload`,
        {
          method: "POST",
          headers: await getHeaderForFormData(),
          body: formData,
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to upload documents");
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  }

  static async decomposeDocuments(documentKeys: string[]) {
    try {
      const response = await fetch(
        `/api/v1/ppt/files/decompose`,
        {
          method: "POST",
          headers: await getHeader(),
          body: JSON.stringify({
            file_paths: documentKeys,
          }),
          cache: "no-cache",
        }
      );
      
      return await ApiResponseHandler.handleResponse(response, "Failed to decompose documents");
    } catch (error) {
      console.error("Error in Decompose Files", error);
      throw error;
    }
  }
 
   static async createPresentation({
    content,
    n_slides,
    file_paths,
    language,
    tone,
    verbosity,
    instructions,
    include_table_of_contents,
    include_title_slide,
    web_search,
    
  }: {
    content: string;
    n_slides: number | null;
    file_paths?: string[];
    language: string | null;
    tone?: string | null;
    verbosity?: string | null;
    instructions?: string | null;
    include_table_of_contents?: boolean;
    include_title_slide?: boolean;
    web_search?: boolean;
  }) {
    try {
      const response = await fetch(
        `/api/v1/ppt/presentation/create`,
        {
          method: "POST",
          headers: await getHeader(),
          body: JSON.stringify({
            content,
            n_slides,
            file_paths,
            language,
            tone,
            verbosity,
            instructions,
            include_table_of_contents,
            include_title_slide,
            web_search,
          }),
          cache: "no-cache",
        }
      );
      
      return await ApiResponseHandler.handleResponse(response, "Failed to create presentation");
    } catch (error) {
      console.error("error in presentation creation", error);
      throw error;
    }
  }

  static async updateSlideNote(slide_id: string, note: string) {
    try {
      const response = await fetch(`/api/v1/ppt/slide/${slide_id}/note`, {
        method: "PATCH",
        headers: await getHeader(),
        body: JSON.stringify({ note }),
        cache: "no-cache",
      });
      return await ApiResponseHandler.handleResponse(response, "Failed to save speaker note");
    } catch (error) {
      console.error("error saving speaker note", error);
      throw error;
    }
  }

  static async editSlide(
    slide_id: string,
    prompt: string
  ) {
    try {
      const response = await fetch(
        `/api/v1/ppt/slide/edit`,
        {
          method: "POST",
          headers: await getHeader(),
          body: JSON.stringify({
            id: slide_id,
            prompt,
          }),
          cache: "no-cache",
        }
      );

      return await ApiResponseHandler.handleResponse(response, "Failed to update slide");
    } catch (error) {
      console.error("error in slide update", error);
      throw error;
    }
  }

  static async updatePresentationContent(body: any) {
    try {
      const response = await fetch(
        `/api/v1/ppt/presentation/update`,
        {
          method: "PATCH",
          headers: await getHeader(),
          body: JSON.stringify(body),
          cache: "no-cache",
        }
      );
      
      return await ApiResponseHandler.handleResponse(response, "Failed to update presentation content");
    } catch (error) {
      console.error("error in presentation content update", error);
      throw error;
    }
  }

  static async presentationPrepare(presentationData: any) {
    try {
      const response = await fetch(
        `/api/v1/ppt/presentation/prepare`,
        {
          method: "POST",
          headers: await getHeader(),
          body: JSON.stringify(presentationData),
          cache: "no-cache",
        }
      );
      
      return await ApiResponseHandler.handleResponse(response, "Failed to prepare presentation");
    } catch (error) {
      console.error("error in data generation", error);
      throw error;
    }
  }
  
  // IMAGE AND ICON SEARCH
  
  
  static async generateImage(imageGenerate: ImageGenerate) {
    try {
      const response = await fetch(
        `/api/v1/ppt/images/generate?prompt=${imageGenerate.prompt}`,
        {
          method: "GET",
          headers: await getHeader(),
          cache: "no-cache",
        }
      );
      
      return await ApiResponseHandler.handleResponse(response, "Failed to generate image");
    } catch (error) {
      console.error("error in image generation", error);
      throw error;
    }
  }

  static getPreviousGeneratedImages = async (): Promise<PreviousGeneratedImagesResponse[]> => {
    try {
      const response = await fetch(
        `/api/v1/ppt/images/generated`,
        {
          method: "GET",
          headers: await getHeader(),
        }
      );
      
      return await ApiResponseHandler.handleResponse(response, "Failed to get previous generated images");
    } catch (error) {
      console.error("error in getting previous generated images", error);
      throw error;
    }
  }
  
  static async searchIcons(iconSearch: IconSearch) {
    try {
      const response = await fetch(
        `/api/v1/ppt/icons/search?query=${iconSearch.query}&limit=${iconSearch.limit}`,
        {
          method: "GET",
          headers: await getHeader(),
          cache: "no-cache",
        }
      );
      
      return await ApiResponseHandler.handleResponse(response, "Failed to search icons");
    } catch (error) {
      console.error("error in icon search", error);
      throw error;
    }
  }



  // EXPORT PRESENTATION — both endpoints now return the file as a binary download
  static async exportAsPPTX(presentationData: any): Promise<Blob> {
    const response = await fetch(`/api/v1/ppt/presentation/export/pptx`, {
      method: "POST",
      headers: await getHeader(),
      body: JSON.stringify(normalizeExportModel(presentationData)),
      cache: "no-cache",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).detail || "Failed to export as PowerPoint");
    }
    return response.blob();
  }

  static async exportAsPDFFromModel(presentationData: any): Promise<Blob> {
    const response = await fetch(`/api/v1/ppt/presentation/export/pdf`, {
      method: "POST",
      headers: await getHeader(),
      body: JSON.stringify(normalizeExportModel(presentationData)),
      cache: "no-cache",
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).detail || "Failed to export as PDF");
    }
    return response.blob();
  }
}
