"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { CustomTemplates, useCustomTemplatePreview, useCustomTemplateSummaries } from "@/app/hooks/useCustomTemplates";
import { CompiledLayout } from "@/app/hooks/compileLayout";
import TemplateService from "../../services/api/template";

const PREVIEW_SCALE_STYLE = { width: "833.33%", height: "833.33%" };
const PLACEHOLDERS = [0, 1, 2, 3];

function openTemplateId(id: string) {
  return id.startsWith("custom-") ? id : `custom-${id}`;
}

function deleteTemplateId(id: string) {
  return id.startsWith("custom-") ? id.slice("custom-".length) : id;
}

function TemplateCard({
  template,
  onDeleted,
}: {
  template: CustomTemplates;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const { previewLayouts, loading, totalLayouts } = useCustomTemplatePreview(template.id);
  const [deleting, setDeleting] = useState(false);

  const handleOpen = () => {
    router.push(`/template-preview/${openTemplateId(template.id)}`);
  };

  const handleDelete = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const confirmed = window.confirm(`Delete "${template.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      setDeleting(true);
      await TemplateService.deleteCustomTemplate(deleteTemplateId(template.id));
      toast.success("Template deleted");
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card
      className="group relative min-h-[260px] cursor-pointer overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      onClick={handleOpen}
    >
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {loading ? (
            PLACEHOLDERS.map((index) => (
              <div
                key={`${template.id}-loading-${index}`}
                className="relative flex aspect-video items-center justify-center overflow-hidden rounded border border-violet-100 bg-gradient-to-br from-violet-50 to-slate-50"
              >
                <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
              </div>
            ))
          ) : previewLayouts.length > 0 ? (
            previewLayouts.slice(0, 4).map((layout: CompiledLayout, index: number) => {
              const LayoutComponent = layout.component;
              return (
                <div
                  key={`${template.id}-preview-${index}`}
                  className="relative aspect-video overflow-hidden rounded border border-gray-200 bg-gray-100"
                >
                  <div className="pointer-events-none absolute inset-0 z-10 bg-transparent" />
                  <div className="origin-top-left scale-[0.12]" style={PREVIEW_SCALE_STYLE}>
                    <LayoutComponent data={layout.sampleData} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 flex aspect-video items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
              No preview available
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-950">{template.name}</h3>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {totalLayouts || template.layoutCount || 0} layouts
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-100 bg-white text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Delete ${template.name}`}
            title="Delete template"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition group-hover:text-violet-600">
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Card>
  );
}

export default function MyTemplatesPage() {
  const router = useRouter();
  const { templates, loading, error, refetch } = useCustomTemplateSummaries();
  const [query, setQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) => template.name.toLowerCase().includes(normalized));
  }, [query, templates]);

  return (
    <div className="min-h-screen bg-transparent px-4 pb-28 pt-10 font-syne text-slate-950 sm:px-6 md:px-10 md:pb-10">
      <header className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-unbounded text-3xl font-semibold md:text-4xl">My Templates</h1>
            <p className="mt-2 text-sm font-medium text-slate-600">
              {loading ? "Loading templates..." : `${templates.length} saved templates`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/custom-template")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Create Template
          </button>
        </div>

        <div className="relative max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your templates"
            className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          />
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-7xl">
        {error ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {PLACEHOLDERS.map((index) => (
              <div key={index} className="h-[260px] animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} onDeleted={refetch} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white px-6 text-center">
            <h2 className="text-lg font-bold text-slate-950">
              {query ? "No templates matched" : "No templates yet"}
            </h2>
            <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
              {query ? "Try a different search term." : "Create a custom template and it will appear here."}
            </p>
            {!query && (
              <button
                type="button"
                onClick={() => router.push("/custom-template")}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Create Template
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
