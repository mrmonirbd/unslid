"use client";
import React, { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileSpreadsheet, Home, Loader2, Minus, MoveDiagonal, Plus, Save, Trash2, Type } from "lucide-react";

import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import TemplateService from "../../services/api/template";
import DashboardSidebar from "../../(dashboard)/Components/DashboardSidebar";
import { toast } from "sonner";
import {
  CustomTemplateDetail,
  CustomTemplateLayout,
  getCustomTemplateDetails,
  useCustomTemplateDetails,
} from "@/app/hooks/useCustomTemplates";
import { templates as templateGroups, getTemplatesByTemplateName } from "@/app/presentation-templates";
import { api } from "@/lib/api";
import { useUser } from "@/app/hooks/useUser";

interface PptxDesignerTemplate {
  id: number;
  name: string;
  description: string;
  tier: "free" | "premium";
  slide_count: number;
  thumbnail_urls: string[];
  file_url?: string;
  color_scheme: Record<string, string> | null;
  font_scheme: Record<string, string> | null;
  html_template_id?: string | null;
  html_template_slug?: string | null;
  html_conversion_status?: "pending" | "processing" | "completed" | "failed";
  html_conversion_error?: string | null;
  locked?: boolean;
}

interface SelectableTextBox {
  text: string;
  left_pct: number;
  top_pct: number;
  width_pct: number;
  height_pct: number;
  font_size_pt?: number | null;
}

interface SelectableDesignerSlide {
  slide_number: number;
  thumbnail_url: string | null;
  text_boxes: SelectableTextBox[];
}

interface SelectableDesignerPreview {
  id: number;
  name: string;
  slide_count: number;
  slides: SelectableDesignerSlide[];
}

function TemplatePreviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <DashboardSidebar />
      <div className="flex-1 h-screen overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

function buildStaticLayoutCode(layout: CustomTemplateLayout, html: string) {
  return `
import * as z from "zod";

const layoutId = ${JSON.stringify(layout.rawLayoutId || layout.layoutId || "custom-layout")};
const layoutName = ${JSON.stringify(layout.rawLayoutName || layout.layoutName || "Custom Layout")};
const layoutDescription = ${JSON.stringify(layout.layoutDescription || "")};
const Schema = z.object({});
const EDITED_TEMPLATE_HTML = ${JSON.stringify(html)};

const dynamicSlideLayout = () => (
  <div
    style={{ width: "1280px", height: "720px", position: "relative", overflow: "hidden", background: "#ffffff" }}
    dangerouslySetInnerHTML={{ __html: EDITED_TEMPLATE_HTML }}
  />
);

export default dynamicSlideLayout;
`;
}

function cleanEditedLayoutHtml(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>("[data-admin-editable]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute("data-admin-editable");
    element.removeAttribute("data-selected-admin-editable");
    element.style.outline = "";
    element.style.outlineOffset = "";
    element.style.cursor = "";
    element.style.resize = "";
  });
  return clone.innerHTML;
}

function makeTextElementsEditable(root: HTMLElement, onSelect: (element: HTMLElement) => void) {
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,span,div,li,td,th,strong,em")
  );

  candidates.forEach((element) => {
    const text = element.textContent?.trim();
    if (!text) return;

    const childWithText = Array.from(element.children).some(
      (child) => child.textContent?.trim()
    );
    if (childWithText && element.children.length > 0) return;

    element.contentEditable = "true";
    element.dataset.adminEditable = "true";
    element.spellcheck = false;
    element.style.cursor = "text";
    if (getComputedStyle(element).display === "inline") {
      element.style.display = "inline-block";
    }
    element.style.minWidth ||= "24px";
    element.style.minHeight ||= "18px";

    element.onmousedown = (event) => {
      event.stopPropagation();
      onSelect(element);
    };
    element.onfocus = () => onSelect(element);
  });
}

function AdminEditableLayout({
  layout,
  templateId,
  onSaved,
  children,
}: {
  layout: CustomTemplateLayout;
  templateId: string;
  onSaved?: () => void;
  children: React.ReactNode;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLElement | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("No text selected");
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const selectElement = React.useCallback((element: HTMLElement | null) => {
    selectedRef.current?.removeAttribute("data-selected-admin-editable");
    selectedRef.current && (selectedRef.current.style.outline = "");
    selectedRef.current && (selectedRef.current.style.outlineOffset = "");

    selectedRef.current = element;
    if (!element) {
      setSelectedLabel("No text selected");
      setFontSize(null);
      return;
    }

    element.dataset.selectedAdminEditable = "true";
    element.style.outline = "2px solid #4f46e5";
    element.style.outlineOffset = "2px";
    const computedSize = Number.parseFloat(getComputedStyle(element).fontSize || "16");
    setFontSize(Number.isFinite(computedSize) ? Math.round(computedSize) : 16);
    setSelectedLabel(element.textContent?.trim().slice(0, 42) || "Selected text");
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    makeTextElementsEditable(root, selectElement);
    return () => {
      root.querySelectorAll<HTMLElement>("[data-admin-editable]").forEach((element) => {
        element.onmousedown = null;
        element.onfocus = null;
      });
    };
  }, [children, selectElement, storageKey]);

  const changeFontSize = (delta: number) => {
    const selected = selectedRef.current;
    if (!selected) return;
    const current = Number.parseFloat(getComputedStyle(selected).fontSize || "16");
    const next = Math.max(6, Math.min(160, Math.round(current + delta)));
    selected.style.fontSize = `${next}px`;
    setFontSize(next);
  };

  const enableResize = () => {
    const selected = selectedRef.current;
    if (!selected) return;
    const rect = selected.getBoundingClientRect();
    selected.style.width ||= `${Math.ceil(rect.width)}px`;
    selected.style.height ||= `${Math.ceil(rect.height)}px`;
    selected.style.overflow = "auto";
    selected.style.resize = "both";
    selected.style.outline = "2px solid #4f46e5";
  };

  const saveLayout = async () => {
    if (!rootRef.current) return;
    try {
      setSaving(true);
      const html = cleanEditedLayoutHtml(rootRef.current);
      await api.put("/api/v1/ppt/template/update", {
        id: templateId,
        layouts: [
          {
            layout_id: layout.rawLayoutId,
            layout_name: layout.rawLayoutName || layout.layoutName || "Custom Layout",
            layout_code: buildStaticLayoutCode(layout, html),
          },
        ],
      });
      toast.success("Template layout saved");
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save layout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm text-indigo-900">
          <Type className="h-4 w-4 shrink-0" />
          <span className="truncate">{selectedLabel}</span>
          {fontSize ? <span className="rounded bg-white px-2 py-0.5 font-mono text-xs">{fontSize}px</span> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => changeFontSize(-2)} title="Decrease font size">
            <Minus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => changeFontSize(2)} title="Increase font size">
            <Plus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={enableResize} title="Make selected text resizable">
            <MoveDiagonal className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" onClick={saveLayout} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
      <div ref={rootRef} onMouseDown={(event) => event.currentTarget === event.target && selectElement(null)}>
        {children}
      </div>
    </div>
  );
}

type StaticEditableSelection = {
  type: "text" | "image";
  element: HTMLElement;
  label: string;
  editorId: string;
};

type StaticEditorPanelState = {
  selection: StaticEditableSelection | null;
  fontSize: number;
  fontFamily: string;
  imageUrl: string;
  animation: string;
  saveState: "idle" | "saved";
  actions: {
    updateFontSize: (size: number) => void;
    setFontFamily: (family: string) => void;
    toggleBold: () => void;
    toggleItalic: () => void;
    setColor: (color: string) => void;
    replaceImage: (url: string) => void;
    replaceImageFile: (file: File) => void;
    setAnimation: (animation: string) => void;
    enableResize: () => void;
    moveSelected: (dx: number, dy: number) => void;
    clearSelection: () => void;
    saveEdits: () => void;
    resetEdits: () => void;
  } | null;
};

type StaticEditorSavedTemplateMeta = {
  userKey: string;
  templateId: string;
  name: string;
  description: string;
  layoutCount: number;
};

const STATIC_EDITOR_ANIMATIONS: Record<string, string> = {
  none: "",
  fade: "staticEditorFade 800ms ease both",
  rise: "staticEditorRise 800ms ease both",
  zoom: "staticEditorZoom 700ms ease both",
  pulse: "staticEditorPulse 1200ms ease-in-out infinite",
};

const STATIC_TEMPLATE_EDIT_INDEX_PREFIX = "static-template-edits:index:";

function saveStaticTemplateEditIndex(meta: StaticEditorSavedTemplateMeta) {
  const indexKey = `${STATIC_TEMPLATE_EDIT_INDEX_PREFIX}${meta.userKey}`;
  const saved = window.localStorage.getItem(indexKey);
  const entries = saved ? JSON.parse(saved) as Array<StaticEditorSavedTemplateMeta & { id: string; updatedAt: string }> : [];
  const id = `edited-${meta.templateId}`;
  const nextEntry = { ...meta, id, updatedAt: new Date().toISOString() };
  const nextEntries = [nextEntry, ...entries.filter((entry) => entry.id !== id)];
  window.localStorage.setItem(indexKey, JSON.stringify(nextEntries));
}

const EMPTY_STATIC_EDITOR_PANEL_STATE: StaticEditorPanelState = {
  selection: null,
  fontSize: 24,
  fontFamily: "Inter, Arial, sans-serif",
  imageUrl: "",
  animation: "none",
  saveState: "idle",
  actions: null,
};

function StaticTemplateEditPanel({ state }: { state: StaticEditorPanelState }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftImageUrl, setDraftImageUrl] = useState(state.imageUrl);
  const actions = state.actions;
  const selection = state.selection;
  const isText = selection?.type === "text";
  const isImage = selection?.type === "image";

  useEffect(() => {
    setDraftImageUrl(state.imageUrl);
  }, [state.imageUrl, selection?.element]);

  if (!selection || !actions) {
    return null;
  }

  return (
    <div
      data-static-editor-panel="true"
      className="sticky top-[132px] z-40 mx-auto mb-6 flex w-full max-w-[1440px] flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
    >
      <span className="max-w-[240px] truncate rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
        {selection.type}: {selection.label}
      </span>
      <select
        className="h-9 rounded-md border px-2 text-sm"
        value={state.fontFamily}
        disabled={!isText}
        onChange={(event) => actions.setFontFamily(event.target.value)}
      >
        <option value="Inter, Arial, sans-serif">Inter</option>
        <option value="Impact, Arial Black, sans-serif">Impact</option>
        <option value="Georgia, serif">Georgia</option>
        <option value="'Times New Roman', serif">Times</option>
        <option value="'Courier New', monospace">Courier</option>
        <option value="Arial, sans-serif">Arial</option>
      </select>
      <Button type="button" variant="outline" size="sm" disabled={!isText} onClick={() => actions.updateFontSize(state.fontSize - 4)}>
        <Minus className="h-4 w-4" />
      </Button>
      <input
        className="h-9 w-16 rounded-md border px-2 text-sm"
        type="number"
        min={8}
        max={180}
        value={state.fontSize}
        disabled={!isText}
        onChange={(event) => actions.updateFontSize(Number(event.target.value))}
      />
      <Button type="button" variant="outline" size="sm" disabled={!isText} onClick={() => actions.updateFontSize(state.fontSize + 4)}>
        <Plus className="h-4 w-4" />
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!isText} onClick={actions.toggleBold}>B</Button>
      <Button type="button" variant="outline" size="sm" disabled={!isText} onClick={actions.toggleItalic}>I</Button>
      <input
        type="color"
        className="h-9 w-10 rounded-md border bg-white p-1"
        disabled={!isText}
        onChange={(event) => actions.setColor(event.target.value)}
        title="Text color"
      />
      <Button type="button" variant="outline" size="sm" disabled={!isImage} onClick={() => fileInputRef.current?.click()}>
        Replace image
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) actions.replaceImageFile(file);
          event.target.value = "";
        }}
      />
      <input
        className="h-9 w-56 rounded-md border px-2 text-xs"
        value={draftImageUrl}
        disabled={!isImage}
        placeholder="Image URL"
        onChange={(event) => setDraftImageUrl(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && actions.replaceImage(draftImageUrl)}
      />
      <select
        className="h-9 rounded-md border px-2 text-sm"
        value={state.animation}
        onChange={(event) => actions.setAnimation(event.target.value)}
      >
        <option value="none">No animation</option>
        <option value="fade">Fade</option>
        <option value="rise">Rise</option>
        <option value="zoom">Zoom</option>
        <option value="pulse">Pulse</option>
      </select>
      <Button type="button" variant="outline" size="sm" onClick={actions.enableResize}>Resize</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.moveSelected(-8, 0)}>←</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.moveSelected(8, 0)}>→</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.moveSelected(0, -8)}>↑</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => actions.moveSelected(0, 8)}>↓</Button>
      <Button type="button" variant="ghost" size="sm" onClick={actions.clearSelection}>Done</Button>
      <Button type="button" size="sm" onClick={actions.saveEdits} className="gap-2">
        <Save className="h-4 w-4" />
        {state.saveState === "saved" ? "Saved" : "Save for me"}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={actions.resetEdits}>
        Reset
      </Button>
    </div>
  );
}

function cleanStaticEditorHtml(root: HTMLElement) {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>("[data-static-editor-text],[data-static-editor-image]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute("data-static-editor-text");
    element.removeAttribute("data-static-editor-image");
    element.removeAttribute("spellcheck");
    element.style.outline = "";
    element.style.outlineOffset = "";
    element.style.cursor = "";
  });
  return clone.innerHTML;
}

function StaticTemplateEditor({
  children,
  storageKey,
  editorId,
  onPanelStateChange,
  savedTemplateMeta,
}: {
  children: React.ReactNode;
  storageKey: string;
  editorId: string;
  onPanelStateChange: (state: StaticEditorPanelState) => void;
  savedTemplateMeta: StaticEditorSavedTemplateMeta;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<StaticEditableSelection | null>(null);
  const loadedStorageKeyRef = useRef<string | null>(null);
  const [selection, setSelection] = useState<StaticEditableSelection | null>(null);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState("Inter, Arial, sans-serif");
  const [imageUrl, setImageUrl] = useState("");
  const [animation, setAnimation] = useState("none");
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  const clearSelection = React.useCallback(() => {
    const previous = selectedRef.current?.element;
    if (previous) {
      previous.style.outline = "";
      previous.style.outlineOffset = "";
    }
    selectedRef.current = null;
    setSelection(null);
    onPanelStateChange(EMPTY_STATIC_EDITOR_PANEL_STATE);
  }, [onPanelStateChange]);

  const selectElement = React.useCallback((type: "text" | "image", element: HTMLElement) => {
    selectedRef.current?.element && (selectedRef.current.element.style.outline = "");
    selectedRef.current?.element && (selectedRef.current.element.style.outlineOffset = "");

    element.style.outline = "3px solid #7c3aed";
    element.style.outlineOffset = "3px";
    const label = type === "image"
      ? "Selected image"
      : element.textContent?.trim().slice(0, 48) || "Selected text";
    const next = { type, element, label, editorId };
    selectedRef.current = next;
    setSelection(next);

    const computed = getComputedStyle(element);
    const nextSize = Number.parseFloat(computed.fontSize || "24");
    setFontSize(Number.isFinite(nextSize) ? Math.round(nextSize) : 24);
    setFontFamily(computed.fontFamily || "Inter, Arial, sans-serif");
    setAnimation(Object.entries(STATIC_EDITOR_ANIMATIONS).find(([, value]) => value && computed.animation.includes(value.split(" ")[0]))?.[0] || "none");
    if (type === "image" && element instanceof HTMLImageElement) {
      setImageUrl(element.src);
    }
  }, [editorId]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (loadedStorageKeyRef.current !== storageKey) {
      const savedHtml = window.localStorage.getItem(storageKey);
      if (savedHtml) {
        root.innerHTML = savedHtml;
      }
      loadedStorageKeyRef.current = storageKey;
    }

    const textElements = Array.from(root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,span,li,strong,em,button,div"))
      .filter((element) => {
        const text = element.textContent?.trim();
        if (!text) return false;
        const hasTextChild = Array.from(element.children).some((child) => child.textContent?.trim());
        return !(hasTextChild && element.children.length > 0);
      });

    textElements.forEach((element) => {
      element.contentEditable = "true";
      element.spellcheck = false;
      element.dataset.staticEditorText = "true";
      element.style.cursor = "text";
      if (getComputedStyle(element).display === "inline") {
        element.style.display = "inline-block";
      }
      element.addEventListener("mousedown", (event) => {
        event.stopPropagation();
        selectElement("text", element);
      });
      element.addEventListener("focus", () => selectElement("text", element));
    });

    const imageElements = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    imageElements.forEach((image) => {
      image.dataset.staticEditorImage = "true";
      image.style.cursor = "pointer";
      image.draggable = false;
      image.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectElement("image", image);
      });
    });
  }, [children, selectElement, storageKey]);

  const saveEdits = () => {
    const root = rootRef.current;
    if (!root) return;
    window.localStorage.setItem(storageKey, cleanStaticEditorHtml(root));
    saveStaticTemplateEditIndex(savedTemplateMeta);
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 1400);
  };

  const resetEdits = () => {
    window.localStorage.removeItem(storageKey);
    window.location.reload();
  };

  const applyToSelected = (updater: (element: HTMLElement) => void) => {
    if (!selectedRef.current?.element) return;
    updater(selectedRef.current.element);
  };

  const updateFontSize = (nextSize: number) => {
    const size = Math.max(8, Math.min(180, Math.round(nextSize)));
    setFontSize(size);
    applyToSelected((element) => {
      element.style.fontSize = `${size}px`;
      element.style.lineHeight = "1.05";
    });
  };

  const replaceImage = (url: string) => {
    const element = selectedRef.current?.element;
    if (!element || !(element instanceof HTMLImageElement) || !url.trim()) return;
    element.src = url.trim();
    setImageUrl(url.trim());
  };

  const replaceImageFile = (file: File) => {
    replaceImage(URL.createObjectURL(file));
  };

  const enableResize = () => {
    applyToSelected((element) => {
      const rect = element.getBoundingClientRect();
      element.style.width ||= `${Math.ceil(rect.width)}px`;
      element.style.height ||= `${Math.ceil(rect.height)}px`;
      element.style.resize = "both";
      element.style.overflow = "auto";
    });
  };

  const moveSelected = (dx: number, dy: number) => {
    applyToSelected((element) => {
      const computed = getComputedStyle(element);
      if (computed.position === "static") {
        element.style.position = "relative";
      }
      const left = Number.parseFloat(element.style.left || "0");
      const top = Number.parseFloat(element.style.top || "0");
      element.style.left = `${left + dx}px`;
      element.style.top = `${top + dy}px`;
    });
  };

  useEffect(() => {
    if (!selection) return;
    onPanelStateChange({
      selection,
      fontSize,
      fontFamily,
      imageUrl,
      animation,
      saveState,
      actions: {
        updateFontSize,
        setFontFamily: (family) => {
          setFontFamily(family);
          applyToSelected((element) => { element.style.fontFamily = family; });
        },
        toggleBold: () => applyToSelected((element) => { element.style.fontWeight = element.style.fontWeight === "900" ? "" : "900"; }),
        toggleItalic: () => applyToSelected((element) => { element.style.fontStyle = element.style.fontStyle === "italic" ? "" : "italic"; }),
        setColor: (color) => applyToSelected((element) => { element.style.color = color; }),
        replaceImage,
        replaceImageFile,
        setAnimation: (nextAnimation) => {
          setAnimation(nextAnimation);
          applyToSelected((element) => { element.style.animation = STATIC_EDITOR_ANIMATIONS[nextAnimation]; });
        },
        enableResize,
        moveSelected,
        clearSelection,
        saveEdits,
        resetEdits,
      },
    });
  }, [selection, fontSize, fontFamily, imageUrl, animation, saveState, onPanelStateChange]);

  useEffect(() => {
    if (!selection) return;

    const handleOutsideMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (target instanceof HTMLElement && target.closest("[data-static-editor-panel='true']")) return;
      clearSelection();
    };

    document.addEventListener("mousedown", handleOutsideMouseDown, true);
    return () => document.removeEventListener("mousedown", handleOutsideMouseDown, true);
  }, [clearSelection, selection]);

  return (
    <div className="space-y-3">
      <style>{`
        @keyframes staticEditorFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes staticEditorRise { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes staticEditorZoom { from { opacity: 0; transform: scale(.86); } to { opacity: 1; transform: scale(1); } }
        @keyframes staticEditorPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
      `}</style>
      <div ref={rootRef} onMouseDown={(event) => event.currentTarget === event.target && clearSelection()}>
        {children}
      </div>
    </div>
  );
}

const DESIGNER_18_EXCEL_SHEETS = [
  {
    name: "Financial Summary",
    columns: ["Metric", "Q1", "Q2", "Q3", "Q4", "Total"],
    rows: [
      ["Revenue", "$128,400", "$143,900", "$156,200", "$171,500", "$600,000"],
      ["Cost of Sales", "$42,100", "$47,800", "$51,300", "$55,600", "$196,800"],
      ["Gross Profit", "$86,300", "$96,100", "$104,900", "$115,900", "$403,200"],
      ["Operating Expense", "$31,200", "$34,500", "$36,100", "$39,400", "$141,200"],
      ["Net Profit", "$55,100", "$61,600", "$68,800", "$76,500", "$262,000"],
    ],
  },
  {
    name: "Pipeline",
    columns: ["Account", "Stage", "Owner", "Value", "Close Date", "Status"],
    rows: [
      ["Northstar Retail", "Proposal", "A. Rahman", "$42,000", "2026-05-18", "On track"],
      ["Helio Finance", "Negotiation", "S. Karim", "$58,500", "2026-05-24", "Review"],
      ["Atlas Health", "Discovery", "N. Ahmed", "$31,750", "2026-06-03", "New"],
      ["Metro Foods", "Contract", "T. Islam", "$74,200", "2026-06-11", "Priority"],
      ["Vertex Labs", "Proposal", "M. Hasan", "$49,600", "2026-06-19", "On track"],
    ],
  },
  {
    name: "Monthly Budget",
    columns: ["Category", "Budget", "Actual", "Variance", "Owner", "Notes"],
    rows: [
      ["Marketing", "$32,000", "$29,850", "$2,150", "Growth", "Under budget"],
      ["Product", "$48,500", "$51,200", "-$2,700", "Product", "Hiring overlap"],
      ["Operations", "$26,400", "$24,900", "$1,500", "Ops", "Stable"],
      ["Sales", "$39,700", "$41,100", "-$1,400", "Sales", "Travel increase"],
      ["Support", "$18,900", "$17,750", "$1,150", "CX", "Under budget"],
    ],
  },
  {
    name: "KPI Tracker",
    columns: ["KPI", "Target", "Current", "Delta", "Trend", "Comment"],
    rows: [
      ["MRR", "$210,000", "$226,400", "+7.8%", "Up", "Ahead of plan"],
      ["Churn", "3.2%", "2.7%", "-0.5%", "Down", "Improving"],
      ["Activation", "64%", "68%", "+4%", "Up", "Better onboarding"],
      ["NPS", "48", "52", "+4", "Up", "Healthy"],
      ["CAC Payback", "11 mo", "10 mo", "-1 mo", "Down", "Efficient"],
    ],
  },
];

function ReadOnlyExcelPreview({ title }: { title: string }) {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-12">
      {DESIGNER_18_EXCEL_SHEETS.map((sheet, sheetIndex) => (
        <Card
          key={sheet.name}
          id={`excel-sheet-${sheetIndex + 1}`}
          className="overflow-hidden border-slate-200 shadow-md"
        >
          <div className="flex items-center justify-between border-b bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {sheet.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {title} • Sheet {sheetIndex + 1} of {DESIGNER_18_EXCEL_SHEETS.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-slate-100 px-3 py-1 text-sm font-mono text-slate-600">
                excel:sheet-{sheetIndex + 1}
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                Non editable
              </span>
            </div>
          </div>

          <div className="bg-gray-100 p-6">
          <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">
              <FileSpreadsheet className="h-4 w-4" />
              Read-only Excel Sheet
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-12 border border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-500">
                      #
                    </th>
                    {sheet.columns.map((column) => (
                      <th
                        key={column}
                        className="border border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row, rowIndex) => (
                    <tr key={`${sheet.name}-${rowIndex}`} className="odd:bg-white even:bg-slate-50/70">
                      <td className="border border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-500">
                        {rowIndex + 1}
                      </td>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${sheet.name}-${rowIndex}-${cellIndex}`}
                          className="border border-slate-200 px-3 py-2 text-slate-700"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </Card>
      ))}
    </div>
  );
}

const GroupLayoutPreview = () => {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();

  const templateParams = params.slug as string;

  // Check if this is a custom template
  const isCustom = templateParams.startsWith("custom-");
  const isDesigner = templateParams.startsWith("designer-");
  const customTemplateId = isCustom ? templateParams.split("custom-")[1] : null;
  const designerTemplateId = isDesigner ? Number(templateParams.split("designer-")[1]) : null;
  const shouldShowExcelPreview = designerTemplateId === 18;
  const [designerTemplate, setDesignerTemplate] = useState<PptxDesignerTemplate | null>(null);
  const [designerSelectablePreview, setDesignerSelectablePreview] = useState<SelectableDesignerPreview | null>(null);
  const [designerHtmlTemplate, setDesignerHtmlTemplate] = useState<CustomTemplateDetail | null>(null);
  const [designerLoading, setDesignerLoading] = useState(false);
  const [designerError, setDesignerError] = useState<string | null>(null);
  const [staticEditorPanelState, setStaticEditorPanelState] = useState<StaticEditorPanelState>(EMPTY_STATIC_EDITOR_PANEL_STATE);
  const { user } = useUser();
  const isAdmin = !!user?.is_admin;


  // Fetch static templates if not custom
  const staticTemplates = !isCustom && !isDesigner ? getTemplatesByTemplateName(templateParams) : [];

  const staticGroup = !isCustom && !isDesigner ? templateGroups.find((g: { id: string }) => g.id === templateParams) : null;

  // Fetch custom template details if custom
  const {
    template: customTemplate,
    loading: customLoading,
    error: customError,
  } = useCustomTemplateDetails({ id: templateParams?.split("custom-")[1] || "", name: "", description: "" });



  useEffect(() => {
    const existingScript = document.querySelector('script[src*="tailwindcss.com"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, [templateParams]);

  useEffect(() => {
    if (!isDesigner || !designerTemplateId) return;

    setDesignerLoading(true);
    setDesignerError(null);
    setDesignerHtmlTemplate(null);
    api.get<PptxDesignerTemplate[]>("/api/v1/account/pptx-templates")
      .then(async (templates) => {
        const found = templates.find((template) => template.id === designerTemplateId);
        if (!found) {
          setDesignerError("Designer template not found");
          setDesignerTemplate(null);
          return;
        }
        if (found.locked) {
          router.push("/settings/billing");
          return;
        }
        setDesignerTemplate(found);
        if (found.html_template_id && found.html_conversion_status === "completed") {
          try {
            const convertedTemplate = await getCustomTemplateDetails(
              found.html_template_id,
              found.name,
              found.description || "Designer template converted from PPTX"
            );
            setDesignerHtmlTemplate(convertedTemplate);
          } catch (error) {
            console.warn("Failed to load converted designer HTML template", error);
          }
        }
        return api
          .get<SelectableDesignerPreview>(`/api/v1/account/pptx-templates/${designerTemplateId}/selectable-preview`)
          .then(setDesignerSelectablePreview)
          .catch(() => setDesignerSelectablePreview(null));
      })
      .catch((error: any) => setDesignerError(error?.message ?? "Failed to load designer template"))
      .finally(() => setDesignerLoading(false));
  }, [designerTemplateId, isDesigner, router]);

  const handleDeleteCustomTemplate = async () => {
    if (!customTemplateId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this template? This action cannot be undone."
    );
    if (!confirmed) return;

    const success = await TemplateService.deleteCustomTemplate(customTemplateId);
    if (success.success) {
      toast.success("Template deleted successfully");
      router.push("/template-preview");
    } else {
      toast.error("Failed to delete template");
    }
  };


  // Loading state for custom templates
  if (isCustom && (customLoading)) {
    return (
      <TemplatePreviewShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Compiling templates...</span>
        </div>
      </TemplatePreviewShell>
    );
  }

  if (isDesigner && designerLoading) {
    return (
      <TemplatePreviewShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Loading designer template...</span>
        </div>
      </TemplatePreviewShell>
    );
  }

  // Error state
  if (isCustom && customError) {
    return (
      <TemplatePreviewShell>
        <div className="flex flex-col items-center justify-center py-24">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error loading template</h2>
          <p className="text-gray-600 mb-4">{customError}</p>
          <Button onClick={() => router.push("/template-preview")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </TemplatePreviewShell>
    );
  }

  if (isDesigner && designerError) {
    return (
      <TemplatePreviewShell>
        <div className="flex flex-col items-center justify-center py-24">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error loading template</h2>
          <p className="text-gray-600 mb-4">{designerError}</p>
          <Button onClick={() => router.push("/template-preview")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </TemplatePreviewShell>
    );
  }

  // Empty state
  if (
    (!isCustom && !isDesigner && (!staticGroup || staticTemplates.length === 0)) ||
    (isCustom && (!customTemplate)) ||
    (isDesigner && !designerTemplate)
  ) {
    return (
      <TemplatePreviewShell>
        <div className="flex flex-col items-center justify-center py-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Template not found
          </h2>
          <Button onClick={() => router.push("/template-preview")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </TemplatePreviewShell>
    );
  }

  // Determine what to render
  const templateName = isCustom ? customTemplate?.template.name || "Custom Template" : staticGroup?.name || "";
  const templateDescription = isDesigner
    ? designerTemplate?.description || ""
    : isCustom
    ? customTemplate?.template.description || ""
    : staticGroup?.description || "";
  const layoutCount = isDesigner
    ? designerHtmlTemplate?.layouts.length || designerTemplate?.slide_count || designerTemplate?.thumbnail_urls.length || 0
    : isCustom
    ? customTemplate?.layouts.length || 0
    : staticTemplates.length;
  const resolvedTemplateName = isDesigner ? designerTemplate?.name || "Designer Template" : templateName;

  return (
    <TemplatePreviewShell>
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className=" mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4 max-w-[1440px] mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  trackEvent(MixpanelEvent.TemplatePreview_Back_Button_Clicked, { pathname });
                  router.back();
                }}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  trackEvent(MixpanelEvent.TemplatePreview_All_Groups_Button_Clicked, { pathname });
                  router.push("/template-preview");
                }}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                All Templates
              </Button>
            </div>

            {isCustom && (
              <div className="flex items-center gap-4">

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    trackEvent(MixpanelEvent.TemplatePreview_Delete_Templates_Button_Clicked, { pathname });
                    trackEvent(MixpanelEvent.TemplatePreview_Delete_Templates_API_Call);
                    handleDeleteCustomTemplate();
                  }}
                  className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Template
                </Button>
              </div>
            )}
            {isDesigner && designerTemplate?.file_url && (
              <a
                href={designerTemplate.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-purple-200 bg-white px-3 text-sm font-medium text-purple-700 shadow-sm transition-colors hover:bg-purple-50"
              >
                <Download className="w-4 h-4" />
                Open PPTX
              </a>
            )}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{resolvedTemplateName}</h1>
              {isCustom && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm">
                  Custom
                </span>
              )}
              {isDesigner && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-sm">
                  Designer
                </span>
              )}
            </div>
            <p className="text-gray-600">
              {layoutCount} layout{layoutCount !== 1 ? "s" : ""} •{" "}
              {templateDescription}
            </p>
          </div>
        </div>

      </header>

      {/* Layout Grid - Wrapped in SchemaHighlightProvider for custom templates */}
      <main className="mx-auto px-2 py-8" id="presentation-page">
        {!isCustom && !isDesigner && (
          <StaticTemplateEditPanel state={staticEditorPanelState} />
        )}

        {/* Static Templates */}
        {!isCustom && (
          !isDesigner && (
          <div className="mx-auto w-full max-w-[1440px] space-y-12">
            {staticTemplates.map((template: any, index: number) => {
              const LayoutComponent = template.component;

              return (
                <Card
                  key={`${templateParams}-${template.layoutId}-${index}`}
                  id={template.layoutId}
                  className="overflow-hidden shadow-md"
                >
                  <div className="bg-white px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {template.layoutName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                          {template.layoutDescription}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                          {template.layoutId}
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          #{index + 1}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-100 p-6 flex justify-center overflow-x-auto">
                    <StaticTemplateEditor
                      storageKey={[
                        "static-template-edits",
                        user?.id || user?.email || "guest",
                        templateParams,
                        template.layoutId,
                      ].join(":")}
                      editorId={`${templateParams}-${template.layoutId}-${index}`}
                      onPanelStateChange={setStaticEditorPanelState}
                      savedTemplateMeta={{
                        userKey: String(user?.id || user?.email || "guest"),
                        templateId: templateParams,
                        name: resolvedTemplateName,
                        description: templateDescription,
                        layoutCount,
                      }}
                    >
                      <div
                        className="flex-shrink-0"
                        style={{ width: "1280px", height: "720px" }}
                      >
                        <LayoutComponent data={template.sampleData} />
                      </div>
                    </StaticTemplateEditor>
                  </div>
                </Card>
              );
            })}
          </div>
          )
        )}

        {isDesigner && designerTemplate && shouldShowExcelPreview && (
          <ReadOnlyExcelPreview title={designerTemplate.name || "Excel File"} />
        )}

        {isDesigner && designerTemplate && !shouldShowExcelPreview && designerHtmlTemplate?.layouts.length ? (
          <div className="flex flex-col items-center justify-center w-full gap-10 aspect-video mx-auto">
            {designerHtmlTemplate.layouts.map((layout: CustomTemplateLayout, index: number) => {
              const LayoutComponent = layout.component;
              return (
                <Card
                  key={`${templateParams}-html-${layout.rawLayoutId}-${index}`}
                  id={`designer-html-${layout.rawLayoutId}`}
                  className="overflow-hidden shadow-md"
                >
                  <div className="bg-white px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {layout.rawLayoutName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                          Converted HTML layout from {designerTemplate.name}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                            HTML
                          </span>
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                            {designerTemplate.html_template_slug}:{layout.rawLayoutId}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-100 p-6 flex justify-center overflow-x-auto">
                    {isAdmin && customTemplateId ? (
                      <AdminEditableLayout
                        layout={layout}
                        templateId={customTemplateId}
                        onSaved={() => toast.success("Reload the page to see the saved compiled version")}
                      >
                        <div
                          className="flex-shrink-0"
                          style={{ width: "1280px", height: "720px" }}
                        >
                          <LayoutComponent data={layout.sampleData} />
                        </div>
                      </AdminEditableLayout>
                    ) : (
                      <div
                        className="flex-shrink-0"
                        style={{ width: "1280px", height: "720px" }}
                      >
                        <LayoutComponent data={layout.sampleData} />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}

        {isDesigner && designerTemplate && !shouldShowExcelPreview && !designerHtmlTemplate?.layouts.length && (
          <div className="mx-auto w-full max-w-[1440px] space-y-12">
            {designerTemplate.html_conversion_status && designerTemplate.html_conversion_status !== "completed" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                HTML conversion is {designerTemplate.html_conversion_status}. Showing PPTX thumbnail preview for now.
              </div>
            )}
            {(designerSelectablePreview?.slides.length || designerTemplate.thumbnail_urls.length) > 0 ? (
              (designerSelectablePreview?.slides ?? designerTemplate.thumbnail_urls.map((url, index) => ({
                slide_number: index + 1,
                thumbnail_url: url,
                text_boxes: [],
              }))).map((slide, index) => (
                <Card
                  key={`${templateParams}-designer-slide-${index}`}
                  id={`designer-slide-${slide.slide_number}`}
                  className="overflow-hidden shadow-md"
                >
                  <div className="bg-white px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          Slide {slide.slide_number}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                          {designerTemplate.name}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                            {templateParams}:slide-{index + 1}
                          </span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                            #{index + 1}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-100 p-6 flex justify-center overflow-x-auto">
                    <div
                      className="relative flex-shrink-0 bg-white"
                      style={{ width: "1280px", height: "720px" }}
                    >
                      {slide.thumbnail_url && (
                        <img
                          src={slide.thumbnail_url}
                          alt={`${designerTemplate.name} slide ${slide.slide_number}`}
                          className="absolute inset-0 h-full w-full object-contain"
                          draggable={false}
                        />
                      )}
                      <div className="absolute inset-0 z-10">
                        {slide.text_boxes.map((box, boxIndex) => (
                          <div
                            key={`${slide.slide_number}-${boxIndex}`}
                            className="absolute whitespace-pre-wrap break-words text-transparent selection:bg-indigo-500/30 selection:text-transparent"
                            style={{
                              left: `${box.left_pct}%`,
                              top: `${box.top_pct}%`,
                              width: `${Math.min(100 - box.left_pct, box.width_pct * 1.18)}%`,
                              maxWidth: `calc(100% - ${box.left_pct}%)`,
                              minHeight: `${box.height_pct}%`,
                              fontSize: `${box.font_size_pt ?? 16}pt`,
                              lineHeight: 1.15,
                              color: "transparent",
                              userSelect: "text",
                              WebkitUserSelect: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {box.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="flex flex-1 flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-purple-600" />
                <p className="text-sm font-medium">Preview thumbnails are still generating.</p>
                <p className="mt-1 text-xs">Refresh this page after a few seconds.</p>
              </Card>
            )}
          </div>
        )}

        {/* Custom Templates - with page-level schema editor */}
        {isCustom && (

          <div className="flex flex-col items-center justify-center w-full gap-10  aspect-video mx-auto">
            {/* Slides List */}

            {customTemplate && customTemplate.layouts.map((layout: CustomTemplateLayout, index: number) => {
              const LayoutComponent = layout.component;
              return (
                <Card
                  key={`${templateParams}-${layout.layoutId}-${index}`}
                  id={layout.layoutId}
                  className="overflow-hidden shadow-md"
                >
                  <div className="bg-white px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {layout.rawLayoutName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                          {layout.layoutDescription}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-end justify-end ">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                        {templateParams}:{layout.layoutId}
                      </span>

                    </div>
                  </div>

                  <div className="bg-gray-100 p-6 flex justify-center overflow-x-auto">
                    <div
                      className="flex-shrink-0"
                      style={{ width: "1280px", height: "720px" }}
                    >
                      <LayoutComponent data={layout.sampleData} />
                    </div>
                  </div>
                </Card>
              );
            })}


          </div>
        )}
      </main>
    </TemplatePreviewShell>
  );
};

export default GroupLayoutPreview;
