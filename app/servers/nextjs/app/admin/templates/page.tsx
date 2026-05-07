"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, UserProfile } from "@/lib/api";
import {
  ArrowLeft, LayoutTemplate, Lock, Unlock, Loader2, Save, FileDown,
  Eye, EyeOff, Pencil, Check, X, Trash2, Upload, FileArchive, CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PptxDesignerTemplate {
  id: number;
  name: string;
  description: string;
  tier: "free" | "premium";
  is_active: boolean;
  sort_order: number;
  slide_count: number;
  thumbnail_urls: string[];
  color_scheme: Record<string, string> | null;
  font_scheme: Record<string, string> | null;
  html_template_id?: string | null;
  html_template_slug?: string | null;
  html_conversion_status?: "pending" | "processing" | "completed" | "failed";
  html_conversion_error?: string | null;
  created_at: string;
  updated_at: string;
}

interface BulkImportResponse {
  imported: PptxDesignerTemplate[];
  skipped: { filename: string; reason: string }[];
  failed: { filename: string; reason: string }[];
  summary: {
    imported: number;
    skipped: number;
    failed: number;
    total_pptx: number;
  };
}

// ─── Inline editable name ─────────────────────────────────────────────────────

function InlineName({
  value,
  onSave,
  disabled,
}: {
  value: string;
  onSave: (v: string) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== value) onSave(v);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        disabled={disabled}
        className="group flex items-center gap-1.5 text-left"
        title="Click to rename"
      >
        <span className="font-semibold text-slate-800 text-sm">{value}</span>
        <Pencil className="w-3 h-3 text-slate-300 group-hover:text-indigo-400 transition shrink-0" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
        className="border border-indigo-400 rounded px-2 py-0.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-44"
      />
      <button onClick={commit} className="p-1 text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
      <button onClick={cancel} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
    </div>
  );
}

// ─── Tier + visibility pill controls ─────────────────────────────────────────

function TierPills({
  tier,
  onChange,
  disabled,
}: {
  tier: "free" | "premium";
  onChange: (t: "free" | "premium") => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => onChange("free")}
        disabled={disabled || tier === "free"}
        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold border transition ${
          tier === "free"
            ? "bg-indigo-100 text-indigo-700 border-indigo-300 cursor-default"
            : "bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-500"
        } disabled:cursor-default`}
      >
        <Unlock className="w-3 h-3" /> Free
      </button>
      <button
        onClick={() => onChange("premium")}
        disabled={disabled || tier === "premium"}
        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold border transition ${
          tier === "premium"
            ? "bg-amber-100 text-amber-700 border-amber-300 cursor-default"
            : "bg-white text-slate-400 border-slate-200 hover:border-amber-300 hover:text-amber-500"
        } disabled:cursor-default`}
      >
        <Lock className="w-3 h-3" /> Premium
      </button>
    </div>
  );
}

function VisibilityPill({
  active,
  onChange,
  disabled,
}: {
  active: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!active)}
      disabled={disabled}
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border transition ${
        active
          ? "bg-green-100 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200"
      } disabled:opacity-50`}
    >
      {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
      {active ? "Visible" : "Hidden"}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminTemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Designer PPTX templates
  const [pptx, setPptx] = useState<PptxDesignerTemplate[]>([]);
  const [pptxSaving, setPptxSaving] = useState<number | null>(null);

  // Upload form
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadTier, setUploadTier] = useState<"free" | "premium">("free");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkZipFile, setBulkZipFile] = useState<File | null>(null);
  const [bulkDesc, setBulkDesc] = useState("");
  const [bulkTier, setBulkTier] = useState<"free" | "premium">("free");
  const [bulkResult, setBulkResult] = useState<BulkImportResponse | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");

  const refreshPptxTemplates = useCallback(async () => {
    const rows = await api.get<PptxDesignerTemplate[]>("/api/v1/admin/pptx-templates");
    setPptx(rows);
    return rows;
  }, []);

  const refreshPptxTemplatesSoon = useCallback(() => {
    window.setTimeout(() => {
      refreshPptxTemplates().catch(() => {});
    }, 3500);
  }, [refreshPptxTemplates]);

  useEffect(() => {
    api.get<UserProfile>("/api/v1/account/me").then((u) => {
      if (!u.is_admin) { router.replace("/dashboard"); return; }
      Promise.allSettled([
        api.get<PptxDesignerTemplate[]>("/api/v1/admin/pptx-templates"),
      ]).then(([pptxRes]) => {
        if (pptxRes.status === "fulfilled") setPptx(pptxRes.value);
      }).finally(() => setLoading(false));
    }).catch(() => router.replace("/dashboard"));
  }, [router]);

  // ── Designer PPTX handlers ──────────────────────────────────────────────────

  const savePptx = useCallback(async (id: number, updates: Partial<PptxDesignerTemplate>) => {
    setPptxSaving(id);
    try {
      const updated = await api.put<PptxDesignerTemplate>(`/api/v1/admin/pptx-templates/${id}`, updates);
      setPptx((prev) => prev.map((t) => t.id === id ? { ...t, ...updated } : t));
    } catch { alert("Save failed. Please try again."); }
    finally { setPptxSaving(null); }
  }, []);

  const deletePptx = useCallback(async (id: number) => {
    if (!confirm("Delete this designer template permanently?")) return;
    await api.delete(`/api/v1/admin/pptx-templates/${id}`);
    setPptx((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleUpload = async () => {
    if (!uploadName.trim() || !uploadFile) { alert("Name and file are required."); return; }
    setUploading(true);
    setUploadStatus("Uploading PowerPoint file...");
    try {
      const fd = new FormData();
      fd.append("name", uploadName.trim());
      fd.append("description", uploadDesc.trim());
      fd.append("tier", uploadTier);
      fd.append("file", uploadFile);
      const result = await api.postFormData<PptxDesignerTemplate>("/api/v1/admin/pptx-templates", fd);
      setPptx((prev) => [...prev, result]);
      setUploadName(""); setUploadDesc(""); setUploadFile(null); setUploadTier("free");
      setUploadStatus("Upload complete. Thumbnails and HTML layouts are generating in the background.");
      refreshPptxTemplatesSoon();
    } catch (e: any) { alert("Upload failed: " + (e?.message ?? "Unknown error")); }
    finally { setUploading(false); }
  };

  const handleBulkImport = async () => {
    if (!bulkZipFile) { alert("ZIP file is required."); return; }
    setBulkUploading(true);
    setBulkResult(null);
    setBulkStatus("Uploading ZIP and importing PowerPoint files...");
    try {
      const fd = new FormData();
      fd.append("description", bulkDesc.trim());
      fd.append("tier", bulkTier);
      fd.append("file", bulkZipFile);
      const result = await api.postFormData<BulkImportResponse>("/api/v1/admin/pptx-templates/bulk-import", fd);
      setPptx((prev) => [...prev, ...result.imported]);
      setBulkResult(result);
      setBulkZipFile(null);
      setBulkDesc("");
      setBulkTier("free");
      setBulkStatus(`Import complete. ${result.summary.imported} template${result.summary.imported === 1 ? "" : "s"} added.`);
      refreshPptxTemplatesSoon();
    } catch (e: any) { alert("Bulk import failed: " + (e?.message ?? "Unknown error")); }
    finally { setBulkUploading(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => router.push("/admin")}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-500"
          aria-label="Back to admin"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LayoutTemplate className="w-5 h-5 text-indigo-500" />
        <div>
          <h1 className="font-bold text-slate-800 text-lg leading-none">Imported Templates</h1>
          <p className="text-xs text-slate-400 mt-0.5">Upload PowerPoint files, generate thumbnails, and convert them into HTML layouts</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">

        {/* ── DESIGNER TEMPLATES ─────────────────────────────────────────────── */}
        <>
            {/* Upload card */}
            <div className="bg-white rounded-xl border border-purple-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-500" />
                <h2 className="font-semibold text-slate-700 text-sm">Upload new designer template</h2>
              </div>
              <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Template name *</label>
                    <input
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="e.g. Corporate Blue"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
                    <input
                      value={uploadDesc}
                      onChange={(e) => setUploadDesc(e.target.value)}
                      placeholder="Brief description shown to users"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tier</label>
                    <div className="flex gap-2">
                      {(["free", "premium"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setUploadTier(t)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
                            uploadTier === t
                              ? t === "free" ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-amber-100 text-amber-700 border-amber-300"
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {t === "free" ? "Free" : "Premium"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">.ppt or .pptx file *</label>
                    <input
                      type="file"
                      accept=".ppt,.pptx"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Max 50 MB · Thumbnails auto-generate in ~30 s</p>
                  </div>
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !uploadName.trim() || !uploadFile}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : <><Save className="w-4 h-4" /> Upload Template</>}
                  </button>
                  {uploadStatus && (
                    <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2 text-xs text-purple-700">
                      <div className="flex items-center gap-2">
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{uploadStatus}</span>
                      </div>
                      {uploading && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-purple-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-purple-500" /></div>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ZIP bulk import card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-slate-600" />
                <h2 className="font-semibold text-slate-700 text-sm">Bulk import from ZIP</h2>
              </div>
              <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Default description (optional)</label>
                    <input
                      value={bulkDesc}
                      onChange={(e) => setBulkDesc(e.target.value)}
                      placeholder="Applied to every imported template"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Default tier</label>
                    <div className="flex gap-2">
                      {(["free", "premium"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setBulkTier(t)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
                            bulkTier === t
                              ? t === "free" ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-amber-100 text-amber-700 border-amber-300"
                              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {t === "free" ? "Free" : "Premium"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">.zip file *</label>
                    <input
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed"
                      onChange={(e) => setBulkZipFile(e.target.files?.[0] ?? null)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Max 250 MB ZIP · up to 100 PowerPoint files · names come from filenames</p>
                  </div>
                  <button
                    onClick={handleBulkImport}
                    disabled={bulkUploading || !bulkZipFile}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {bulkUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : <><FileArchive className="w-4 h-4" /> Import ZIP</>}
                  </button>
                  {bulkStatus && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        {bulkUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                        <span>{bulkStatus}</span>
                      </div>
                      {bulkUploading && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-1/2 animate-pulse rounded-full bg-slate-700" /></div>}
                    </div>
                  )}
                  {bulkResult && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <p className="font-semibold text-slate-700">
                        Imported {bulkResult.summary.imported} of {bulkResult.summary.total_pptx} PowerPoint files
                      </p>
                      {(bulkResult.summary.skipped > 0 || bulkResult.summary.failed > 0) && (
                        <p className="mt-1">
                          {bulkResult.summary.skipped} skipped · {bulkResult.summary.failed} failed
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Template cards */}
            {pptx.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <FileDown className="w-12 h-12 mb-3 text-slate-300" />
                <p className="text-sm font-medium">No designer templates yet</p>
                <p className="text-xs mt-1">Upload a .ppt or .pptx file above to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pptx.map((t) => (
                  <div
                    key={t.id}
                    className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition ${!t.is_active ? "opacity-60" : ""}`}
                  >
                    {/* Thumbnails */}
                    <div className="p-3 bg-slate-50 border-b border-slate-100">
                      {t.thumbnail_urls.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1">
                          {t.thumbnail_urls.slice(0, 4).map((url, i) => (
                            <div key={i} className="relative overflow-hidden rounded border border-slate-200" style={{ aspectRatio: "16/9" }}>
                              <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center rounded border border-dashed border-slate-300 bg-white" style={{ aspectRatio: "16/9" }}>
                          <div className="text-center">
                            <Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto mb-1" />
                            <p className="text-[10px] text-slate-400">Generating thumbnails…</p>
                          </div>
                        </div>
                      )}
                      {/* Color swatches */}
                      {t.color_scheme && (
                        <div className="flex gap-1 mt-2 justify-center">
                          {Object.values(t.color_scheme).slice(0, 8).map((color, i) => (
                            <div key={i} title={color} className="w-4 h-4 rounded-sm border border-white shadow-sm" style={{ background: color }} />
                          ))}
                        </div>
                      )}
                    <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-slate-400">
                      <span>{t.slide_count} slides</span>
                      <span>·</span>
                      <span
                        className={
                          t.html_conversion_status === "completed"
                            ? "text-green-600"
                            : t.html_conversion_status === "failed"
                              ? "text-red-600"
                              : "text-amber-600"
                        }
                        title={t.html_conversion_error || undefined}
                      >
                        HTML {t.html_conversion_status ?? "pending"}
                      </span>
                    </div>
                  </div>

                    {/* Controls */}
                    <div className="p-3 space-y-2.5">
                      <InlineName
                        value={t.name}
                        onSave={(v) => savePptx(t.id, { name: v })}
                        disabled={pptxSaving === t.id}
                      />
                      {t.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{t.description}</p>
                      )}
                      <TierPills
                        tier={t.tier}
                        onChange={(tier) => savePptx(t.id, { tier })}
                        disabled={pptxSaving === t.id}
                      />
                      <div className="flex items-center gap-2">
                        <VisibilityPill
                          active={t.is_active}
                          onChange={(v) => savePptx(t.id, { is_active: v })}
                          disabled={pptxSaving === t.id}
                        />
                        <div className="flex items-center gap-1 ml-auto">
                          <label className="text-[10px] text-slate-400">Order</label>
                          <input
                            type="number"
                            min={0}
                            defaultValue={t.sort_order}
                            onBlur={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (!isNaN(v) && v !== t.sort_order) savePptx(t.id, { sort_order: v });
                            }}
                            className="w-12 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          />
                        </div>
                        <button
                          onClick={() => deletePptx(t.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </>
      </div>
    </div>
  );
}
