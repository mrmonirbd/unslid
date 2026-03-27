"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { BarChart2, ExternalLink, Eye, Users, Clock } from "lucide-react";

interface ShareLink {
  token: string;
  presentation_id: string;
  mode: string;
  view_count: number;
  created_at: string;
  presentation_title?: string;
}

interface PerSlide {
  slide_index: number;
  views: number;
  avg_seconds: number;
}

interface Analytics {
  token: string;
  total_views: number;
  unique_viewers: number;
  per_slide: PerSlide[];
}

export default function AnalyticsPage() {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    api.get<ShareLink[]>("/api/v1/account/shares")
      .then((data) => setShares(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const loadAnalytics = async (token: string) => {
    setSelected(token);
    setAnalyticsLoading(true);
    setAnalytics(null);
    try {
      const data = await api.get<Analytics>(`/api/v1/s/${token}/analytics`);
      setAnalytics(data);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const maxViews = analytics ? Math.max(...analytics.per_slide.map((s) => s.views), 1) : 1;

  return (
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-6 h-6 text-indigo-500" />
        <h1 className="text-2xl font-bold text-slate-900">Share Analytics</h1>
      </div>
      <p className="text-sm text-slate-500">
        See how viewers are engaging with your shared presentations.
      </p>

      {loading ? (
        <div className="text-slate-400 text-sm">Loading share links…</div>
      ) : shares.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-sm">
          No shared presentations yet. Share a presentation to see analytics here.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Share list */}
          <div className="lg:col-span-1 space-y-2">
            {shares.map((share) => (
              <button
                key={share.token}
                onClick={() => loadAnalytics(share.token)}
                className={`w-full text-left rounded-xl border p-4 transition ${
                  selected === share.token
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-slate-200 bg-white hover:border-indigo-200"
                }`}
              >
                <p className="font-medium text-slate-800 text-sm truncate">
                  {share.presentation_title || share.presentation_id.slice(0, 8) + "…"}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {share.view_count} views
                  </span>
                  <span className="capitalize px-1.5 py-0.5 rounded-full bg-slate-100">
                    {share.mode}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(share.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>

          {/* Analytics panel */}
          <div className="lg:col-span-2">
            {!selected && (
              <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400 text-sm p-10 text-center">
                Select a share link on the left to view analytics
              </div>
            )}
            {analyticsLoading && (
              <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
                Loading analytics…
              </div>
            )}
            {analytics && !analyticsLoading && (
              <div className="space-y-5">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Total views", value: analytics.total_views, icon: Eye },
                    { label: "Unique viewers", value: analytics.unique_viewers, icon: Users },
                    { label: "Slides tracked", value: analytics.per_slide.length, icon: BarChart2 },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Per-slide bar chart */}
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Views per slide</h3>
                  {analytics.per_slide.length === 0 ? (
                    <p className="text-sm text-slate-400">No slide data yet. Viewers must spend at least 5 seconds on a slide.</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.per_slide.map((s) => (
                        <div key={s.slide_index} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-16 shrink-0">
                            Slide {s.slide_index + 1}
                          </span>
                          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full transition-all duration-500"
                              style={{ width: `${(s.views / maxViews) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600 w-16 shrink-0 text-right">
                            {s.views} views
                          </span>
                          <span className="text-xs text-slate-400 w-20 shrink-0 text-right flex items-center justify-end gap-1">
                            <Clock className="w-3 h-3" />
                            {s.avg_seconds}s avg
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Share link */}
                <a
                  href={`/s/${analytics.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-500"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open share link
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
