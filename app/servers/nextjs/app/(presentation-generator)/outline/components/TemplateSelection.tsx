"use client";
import React, { useEffect, useMemo, useCallback, memo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { TemplateLayoutsWithSettings } from "@/app/presentation-templates/utils";
import { templates } from "@/app/presentation-templates";
import { Card } from "@/components/ui/card";
import { TemplateWithData } from "@/app/presentation-templates/utils";
import { CustomTemplates, useCustomTemplateSummaries } from "@/app/hooks/useCustomTemplates";
import { FileDown, Loader2, Lock } from "lucide-react";
import { CustomTemplateCard } from "./CustomTemplateCard";
import CreateCustomTemplate from "../../(dashboard)/templates/components/CreateCustomTemplate";
import { api, UserProfile } from "@/lib/api";
import { isIframeMode, withIframeSearch } from "@/app/(presentation-generator)/(dashboard)/Components/IframeAwareShell";

const FREE_BUILT_IN_TEMPLATE_LIMIT = 10;

export interface DesignerTemplateSelection {
  type: "designer";
  id: number;
  name: string;
  color_scheme?: Record<string, string> | null;
}

interface PptxDesignerTemplate extends DesignerTemplateSelection {
  description: string;
  tier: "free" | "premium";
  slide_count: number;
  thumbnail_urls: string[];
  color_scheme: Record<string, string> | null;
  font_scheme: Record<string, string> | null;
  locked: boolean;
}

// Memoized layout preview for built-in templates
const BuiltInLayoutPreview = memo(({ layout, templateId, index }: {
  layout: TemplateWithData;
  templateId: string;
  index: number;
}) => {
  const LayoutComponent = layout.component;
  return (
    <div
      className="relative bg-gray-100 font-syne border border-gray-200 overflow-hidden aspect-video rounded"
      style={{ contain: 'layout style paint' }}
    >
      <div className="absolute inset-0 bg-transparent z-10 pointer-events-none" />
      <div
        className="transform scale-[0.12] origin-top-left"
        style={{ width: "833.33%", height: "833.33%" }}
      >
        <LayoutComponent data={layout.sampleData} />
      </div>
    </div>
  );
});
BuiltInLayoutPreview.displayName = 'BuiltInLayoutPreview';

// Memoized built-in template card
const BuiltInTemplateCard = memo(({ template, isSelected, locked, onSelect, onLockedSelect }: {
  template: TemplateLayoutsWithSettings;
  isSelected: boolean;
  locked?: boolean;
  onSelect: (template: TemplateLayoutsWithSettings) => void;
  onLockedSelect: () => void;
}) => {
  const previewLayouts = useMemo(() => template.layouts.slice(0, 4), [template.layouts]);
  const handleClick = useCallback(() => {
    if (locked) {
      onLockedSelect();
      return;
    }
    onSelect(template);
  }, [locked, onLockedSelect, onSelect, template]);

  return (
    <Card
      className={`${isSelected ? 'border-2 border-blue-500' : ''} cursor-pointer relative hover:shadow-lg transition-all duration-200 group overflow-hidden ${locked ? "opacity-80" : ""}`}
      onClick={handleClick}
    >
      {locked && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/40">
          <div className="rounded-full bg-white/90 p-2.5 shadow">
            <Lock className="h-5 w-5 text-amber-600" />
          </div>
          <span className="rounded-full bg-amber-600/90 px-3 py-1 text-xs font-semibold text-white shadow">
            Paid — Upgrade to unlock
          </span>
        </div>
      )}
      <span className="text-xs font-syne absolute top-2 flex gap-1 capitalize items-center left-2 rounded-[100px] px-2.5 py-1 bg-[#3A3A3AF5] text-white font-semibold z-40">
        Layouts- {template.layouts.length}
      </span>
      <img src="/card_bg.svg" alt="" className="absolute top-0 left-0 w-full h-full object-cover" />
      <div className="p-5">
        <div className="grid grid-cols-2 gap-2">
          {previewLayouts.map((layout: TemplateWithData, index: number) => (
            <BuiltInLayoutPreview
              key={`${template.id}-preview-${index}`}
              layout={layout}
              templateId={template.id}
              index={index}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between p-5 bg-white border-t border-[#EDEEEF] relative z-40">
        <div>
          <h3 className="text-sm font-bold text-gray-900 capitalize font-syne">
            {template.name}
            {locked && <Lock className="ml-1 inline h-3 w-3 text-amber-500" />}
          </h3>
          <p className="text-xs text-gray-600  line-clamp-2 font-syne">
            {template.description}
          </p>
        </div>
      </div>
    </Card>
  );
});
BuiltInTemplateCard.displayName = 'BuiltInTemplateCard';

interface TemplateSelectionProps {
  selectedTemplate: (TemplateLayoutsWithSettings | string | DesignerTemplateSelection) | null;
  onSelectTemplate: (template: TemplateLayoutsWithSettings | string | DesignerTemplateSelection) => void;
}

const TemplateSelection: React.FC<TemplateSelectionProps> = memo(({
  selectedTemplate,
  onSelectTemplate
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const iframeMode = isIframeMode(searchParams);
  useEffect(() => {
    const existingScript = document.querySelector(
      'script[src*="tailwindcss.com"]'
    );
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://cdn.tailwindcss.com";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  const { templates: customTemplates, loading: customLoading } = useCustomTemplateSummaries();
  const [plan, setPlan] = useState<string>("free");
  const [planLoaded, setPlanLoaded] = useState(false);
  const [designerTemplates, setDesignerTemplates] = useState<PptxDesignerTemplate[]>([]);
  const [designerLoading, setDesignerLoading] = useState(false);

  useEffect(() => {
    api.get<UserProfile>("/api/v1/account/me")
      .then((user) => setPlan(user.plan ?? "free"))
      .catch(() => setPlan("free"))
      .finally(() => setPlanLoaded(true));
  }, []);

  useEffect(() => {
    setDesignerLoading(true);
    api.get<PptxDesignerTemplate[]>("/api/v1/account/pptx-templates")
      .then((templates) => {
        setDesignerTemplates(templates.map((template) => ({ ...template, type: "designer" })));
      })
      .catch(() => setDesignerTemplates([]))
      .finally(() => setDesignerLoading(false));
  }, []);

  // Stable callback for custom template selection
  const handleCustomSelect = useCallback(
    (template: TemplateLayoutsWithSettings | string) => onSelectTemplate(template),
    [onSelectTemplate]
  );

  // Stable callback for built-in template selection
  const handleBuiltInSelect = useCallback(
    (template: TemplateLayoutsWithSettings) => onSelectTemplate(template),
    [onSelectTemplate]
  );

  const handleLockedSelect = useCallback(() => {
    router.push(withIframeSearch("/settings/billing", searchParams));
  }, [router, searchParams]);

  const isBuiltInTemplateLocked = useCallback(
    (templateIndex: number) => {
      if (iframeMode) return false;
      if (!planLoaded) return false;
      if (plan === "pro" || plan === "team") return false;
      return templateIndex >= FREE_BUILT_IN_TEMPLATE_LIMIT;
    },
    [iframeMode, plan, planLoaded]
  );

  // Derive the selected custom template id only when selectedTemplate changes
  const selectedCustomId = useMemo(
    () => (typeof selectedTemplate === 'string' ? selectedTemplate : null),
    [selectedTemplate]
  );

  // Derive the selected built-in template id only when selectedTemplate changes
  const selectedBuiltInId = useMemo(
    () => (selectedTemplate && typeof selectedTemplate !== 'string' && !("type" in selectedTemplate) ? selectedTemplate.id : null),
    [selectedTemplate]
  );

  const selectedDesignerId = useMemo(
    () => (selectedTemplate && typeof selectedTemplate !== "string" && "type" in selectedTemplate ? selectedTemplate.id : null),
    [selectedTemplate]
  );

  // Memoize the custom templates section
  const customTemplateCards = useMemo(() => {
    if (customLoading) {
      return (
        <div className="flex items-center justify-center py-12 font-syne">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 font-syne" />
          <span className="ml-3 text-gray-600">Loading custom templates...</span>
        </div>
      );
    }
    if (customTemplates.length === 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

          <CreateCustomTemplate />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {customTemplates.map((template: CustomTemplates) => (
          <CustomTemplateCard
            key={template.id}
            template={template}
            onSelectTemplate={handleCustomSelect}
            selectedTemplate={selectedCustomId}
          />
        ))}
      </div>
    );
  }, [customLoading, customTemplates, handleCustomSelect, selectedCustomId]);

  // Memoize the built-in templates list
  const builtInTemplateCards = useMemo(
    () =>
      templates.map((template: TemplateLayoutsWithSettings, index) => (
        <BuiltInTemplateCard
          key={template.id}
          template={template}
          isSelected={selectedBuiltInId === template.id}
          locked={isBuiltInTemplateLocked(index)}
          onSelect={handleBuiltInSelect}
          onLockedSelect={handleLockedSelect}
        />
      )),
    [handleBuiltInSelect, handleLockedSelect, isBuiltInTemplateLocked, selectedBuiltInId]
  );

  const designerTemplateCards = useMemo(() => {
    if (designerLoading) {
      return (
        <div className="flex items-center justify-center py-12 font-syne">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Loading designer templates...</span>
        </div>
      );
    }
    if (designerTemplates.length === 0) return null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {designerTemplates.map((template) => {
          const isSelected = selectedDesignerId === template.id;
          const locked = template.locked && !iframeMode;
          return (
            <Card
              key={`designer-${template.id}`}
              className={`${isSelected ? "border-2 border-purple-500" : ""} cursor-pointer relative hover:shadow-lg transition-all duration-200 group overflow-hidden ${locked ? "opacity-80" : ""}`}
              onClick={() => {
                if (locked) return;
                onSelectTemplate({ type: "designer", id: template.id, name: template.name, color_scheme: template.color_scheme });
              }}
            >
              {locked && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
                  <Lock className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="text-xs font-syne absolute top-2 flex gap-1 capitalize items-center left-2 rounded-[100px] px-2.5 py-1 bg-[#3A3A3AF5] text-white font-semibold z-40">
                Slides- {template.slide_count}
              </span>
              <img src="/card_bg.svg" alt="" className="absolute top-0 left-0 w-full h-full object-cover" />
              <div className="p-5">
                {template.thumbnail_urls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {template.thumbnail_urls.slice(0, 4).map((url, index) => (
                      <div key={index} className="relative bg-gray-100 border border-gray-200 overflow-hidden aspect-video rounded">
                        <img src={url} alt={`${template.name} slide ${index + 1}`} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video bg-purple-50 rounded flex flex-col items-center justify-center gap-2">
                    <FileDown className="w-8 h-8 text-purple-300" />
                    <span className="text-xs text-slate-400">Thumbnails generating...</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-5 bg-white border-t border-[#EDEEEF] relative z-40">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 capitalize font-syne">{template.name}</h3>
                  {template.description && (
                    <p className="text-xs text-gray-600 line-clamp-2 font-syne">{template.description}</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }, [designerLoading, designerTemplates, iframeMode, onSelectTemplate, selectedDesignerId]);

  return (
    <div className="space-y-[30px] mb-4">
      {/* Custom AI Templates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 font-syne">Custom</h3>
        </div>
        {customTemplateCards}
      </div>
      {/* In Built Templates */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3 font-syne">In Built</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {builtInTemplateCards}
        </div>
      </div>
      {designerTemplateCards && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3 font-syne">Designer</h3>
          {designerTemplateCards}
        </div>
      )}
    </div>
  );
});
TemplateSelection.displayName = 'TemplateSelection';

export default TemplateSelection;
