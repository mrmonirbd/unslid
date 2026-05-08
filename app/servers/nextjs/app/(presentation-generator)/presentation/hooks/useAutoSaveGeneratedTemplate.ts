"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/auth/client";

const AUTO_SAVE_PREFIX = "unslid:auto-saved-generated-template:";

const cleanSlideHtml = (html: string) => {
  if (typeof document === "undefined") return html;

  const container = document.createElement("div");
  container.innerHTML = html;

  container.querySelectorAll("[contenteditable]").forEach((node) => {
    node.removeAttribute("contenteditable");
    node.removeAttribute("contentEditable");
  });

  container.querySelectorAll<HTMLElement>(".ProseMirror").forEach((node) => {
    node.removeAttribute("contenteditable");
    node.classList.remove("ProseMirror", "ProseMirror-focused");
  });

  container.querySelectorAll<HTMLElement>("[data-editable-processed]").forEach((node) => {
    node.removeAttribute("data-editable-processed");
    node.removeAttribute("data-editable-id");
    node.style.cursor = "";
    node.style.transition = "";
    node.style.opacity = "";
    node.style.transform = "";
  });

  return container.innerHTML;
};

const buildStaticLayoutCode = (slideIndex: number, html: string) => `
const layoutId = "${slideIndex + 1}";
const layoutName = "Slide ${slideIndex + 1}";
const layoutDescription = "Auto-saved generated slide ${slideIndex + 1}";
const Schema = z.object({});
const generatedSlideHtml = ${JSON.stringify(cleanSlideHtml(html))};

const dynamicSlideLayout = () => (
  <div
    className="relative h-full w-full overflow-hidden [&>*]:mx-auto"
    dangerouslySetInnerHTML={{ __html: generatedSlideHtml }}
  />
);
`;

const postJson = async (path: string, body: unknown) => {
  const authClient = createClient();
  const {
    data: { session },
  } = await authClient.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Request failed");
  }

  return response.json();
};

export const useAutoSaveGeneratedTemplate = ({
  presentationId,
  presentationData,
  isStreaming,
  loading,
}: {
  presentationId: string;
  presentationData: any;
  isStreaming: boolean;
  loading: boolean;
}) => {
  const savingRef = useRef(false);

  useEffect(() => {
    if (!presentationId || !presentationData?.slides?.length || isStreaming || loading) return;
    if (presentationData?.pptx_template_id) return;
    if (savingRef.current) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(`${AUTO_SAVE_PREFIX}${presentationId}`)) return;

    let cancelled = false;

    const timeout = window.setTimeout(async () => {
      if (savingRef.current) return;

      try {
        const slideElements = Array.from(
          document.querySelectorAll<HTMLElement>("[id^='slide-'] [data-slide-content='true']")
        );

        if (!slideElements.length || cancelled) return;

        const layouts = slideElements.map((element, index) => {
          const clone = element.cloneNode(true) as HTMLElement;
          return {
            presentation: presentationId,
            layout_id: `${index + 1}`,
            layout_name: `Slide ${index + 1}`,
            layout_code: buildStaticLayoutCode(index, clone.innerHTML),
            fonts: [] as string[],
          };
        });

        savingRef.current = true;
        const title = presentationData?.title || "Generated Template";

        await postJson("/api/v1/ppt/template-management/templates", {
          id: presentationId,
          name: title,
          description: "Auto-saved from generated presentation",
        });

        await postJson("/api/v1/ppt/template-management/save-templates", { layouts });
        if (!cancelled) {
          window.localStorage.setItem(`${AUTO_SAVE_PREFIX}${presentationId}`, "1");
        }
      } catch (error) {
        console.error("Failed to auto-save generated template:", error);
      } finally {
        savingRef.current = false;
      }
    }, 1800);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [presentationId, presentationData, isStreaming, loading]);
};
