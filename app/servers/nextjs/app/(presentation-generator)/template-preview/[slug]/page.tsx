"use client";
import React, { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileSpreadsheet, Home, Loader2, Trash2 } from "lucide-react";

import { MixpanelEvent, trackEvent } from "@/utils/mixpanel";
import TemplateService from "../../services/api/template";
import Header from "../../(dashboard)/dashboard/components/Header";
import { toast } from "sonner";
import {
  CustomTemplateDetail,
  CustomTemplateLayout,
  getCustomTemplateDetails,
  useCustomTemplateDetails,
} from "@/app/hooks/useCustomTemplates";
import { templates as templateGroups, getTemplatesByTemplateName } from "@/app/presentation-templates";
import { api } from "@/lib/api";

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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Compiling templates...</span>
        </div>
      </div>
    );
  }

  if (isDesigner && designerLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Loading designer template...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (isCustom && customError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex flex-col items-center justify-center py-24">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error loading template</h2>
          <p className="text-gray-600 mb-4">{customError}</p>
          <Button onClick={() => router.push("/template-preview")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </div>
    );
  }

  if (isDesigner && designerError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex flex-col items-center justify-center py-24">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error loading template</h2>
          <p className="text-gray-600 mb-4">{designerError}</p>
          <Button onClick={() => router.push("/template-preview")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (
    (!isCustom && !isDesigner && (!staticGroup || staticTemplates.length === 0)) ||
    (isCustom && (!customTemplate)) ||
    (isDesigner && !designerTemplate)
  ) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex flex-col items-center justify-center py-24">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Template not found
          </h2>
          <Button onClick={() => router.push("/template-preview")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Templates
          </Button>
        </div>
      </div>
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

  console.log('compileLayout', customTemplate)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

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
        {/* Static Templates */}
        {!isCustom && (
          !isDesigner && (
          <div className="space-y-12 w-[1440px] h-[720px] aspect-video mx-auto">
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
                    <div
                      className="flex-shrink-0"
                      style={{ width: "1280px", height: "720px" }}
                    >
                      <LayoutComponent data={template.sampleData} />
                    </div>
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
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
                          HTML
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                          {designerTemplate.html_template_slug}:{layout.rawLayoutId}
                        </span>
                      </div>
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
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-mono">
                          {templateParams}:slide-{index + 1}
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          #{index + 1}
                        </span>
                      </div>
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
    </div>
  );
};

export default GroupLayoutPreview;
