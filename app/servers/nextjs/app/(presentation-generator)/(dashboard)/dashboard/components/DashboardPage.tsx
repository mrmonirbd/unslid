"use client";

import React, { useRef, useState, useEffect } from "react";
import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { PresentationGrid } from "@/app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid";
import Link from "next/link";
import { Upload, Plus, Zap, LayoutGrid, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const DashboardPage: React.FC = () => {
  const router = useRouter();
  const [presentations, setPresentations] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>("free");
  const [userName, setUserName] = useState<string>("");
  const [usage, setUsage] = useState<{ presentations_this_month: number; monthly_limit: number | null } | null>(null);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const authClient = createClient();
        const { data: { session } } = await authClient.auth.getSession();
        if (session?.access_token) {
          const res = await fetch("/api/v1/account/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const profile = await res.json();
            setUserPlan(profile.plan ?? "free");
            setUserName(profile.full_name?.split(" ")[0] || "");
          }
          const usageRes = await fetch("/api/v1/billing/status", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (usageRes.ok) {
            const billing = await usageRes.json();
            setUsage(billing.usage);
          }
        }
      } catch { /* non-fatal */ }
      await fetchPresentations();
    };
    loadData();
  }, []);

  const fetchPresentations = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await DashboardApi.getPresentations();
      data.sort(
        (a: any, b: any) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      setPresentations(data);
    } catch {
      setError(null);
      setPresentations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const authClient = createClient();
      const { data: { session } } = await authClient.auth.getSession();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/ppt/presentation/import", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      router.push(data.edit_url);
    } catch {
      alert("Failed to import presentation. Please ensure it's a valid .pptx file.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const removePresentation = (presentationId: string) => {
    setPresentations((prev: any) =>
      prev ? prev.filter((p: any) => p.id !== presentationId) : []
    );
  };

  const totalCount = presentations?.length ?? 0;
  const thisMonth = usage?.presentations_this_month ?? 0;
  const monthlyLimit = usage?.monthly_limit ?? null;
  const usagePct = monthlyLimit ? Math.min(100, (thisMonth / monthlyLimit) * 100) : 0;

  return (
    <div className="min-h-full px-4 pb-8 font-syne sm:px-6 md:px-8 md:pb-12">

      {/* Page header */}
      <div className="pt-8 pb-6">
        <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {getGreeting()}{userName ? `, ${userName}` : ""} 👋
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Here&rsquo;s your presentation workspace
            </p>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 sm:px-4"
            >
              <Upload className="w-4 h-4" />
              {importing ? "Importing…" : "Import .pptx"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".pptx"
              className="hidden"
              onChange={handleImport}
            />
            <Link
              href="/upload"
              className="inline-flex min-w-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm shadow-violet-500/25 transition-all duration-150 hover:bg-violet-500 sm:px-4"
            >
              <Plus className="w-4 h-4" />
              New Presentation
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid max-w-lg grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 sm:gap-4">
          <div className="bg-white/95 rounded-xl border border-violet-100 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <LayoutGrid className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-medium text-slate-500">Total</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{isLoading ? "—" : totalCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">presentations</p>
          </div>

          <div className="bg-white/95 rounded-xl border border-violet-100 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium text-slate-500">This month</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{thisMonth}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {monthlyLimit ? `of ${monthlyLimit} limit` : "unlimited"}
            </p>
          </div>

          {/* Usage bar — only for free plan with limit */}
          {userPlan === "free" && monthlyLimit && (
            <div className="col-span-1 rounded-xl border border-violet-100 bg-white/95 px-4 py-3 shadow-sm min-[420px]:col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-violet-500" />
                  <span className="text-xs font-medium text-slate-500">Usage</span>
                </div>
                <Link
                  href="/settings/billing"
                  className="text-[11px] font-semibold text-violet-600 hover:text-violet-800"
                >
                  {usagePct >= 100 ? "Upgrade →" : "Upgrade"}
                </Link>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usagePct >= 90 ? "bg-red-500" : "bg-violet-500"}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                {thisMonth} / {monthlyLimit} used
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-200 mb-6" />

      {/* Section title */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">Recent presentations</h2>
        <span className="text-xs text-slate-400">{!isLoading && totalCount > 0 ? `${totalCount} total` : ""}</span>
      </div>

      {/* Grid */}
      <PresentationGrid
        presentations={presentations}
        type="slide"
        isLoading={isLoading}
        error={error}
        onPresentationDeleted={removePresentation}
        userPlan={userPlan}
      />
    </div>
  );
};

export default DashboardPage;
