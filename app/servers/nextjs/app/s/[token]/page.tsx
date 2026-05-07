"use client";

import { useState, useEffect, useRef } from "react";
import { use } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Presentation {
  id: string;
  title: string;
  n_slides: number;
  structure: unknown;
  theme: unknown;
}

interface ShareData {
  token: string;
  mode: string;
  requires_password?: boolean;
  view_count?: number;
  presentation?: Presentation;
}

export default function ShareViewerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const secondsRef = useRef(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/s/${token}`)
      .then((r) => r.json())
      .then(setShareData)
      .catch(() => setError("This share link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  // Heartbeat every 5 seconds while viewing
  useEffect(() => {
    if (!shareData?.presentation) return;
    const tick = setInterval(() => {
      secondsRef.current += 5;
      fetch(`${API_BASE}/api/v1/s/${token}/heartbeat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slide_index: currentSlide, seconds_spent: secondsRef.current }),
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(tick);
  }, [shareData?.presentation, token, currentSlide]);

  const handleUnlock = async () => {
    setUnlocking(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/s/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.detail ?? "Incorrect password");
        return;
      }
      const data = await res.json();
      setShareData((prev) => ({ ...prev!, ...data }));
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading presentation…</div>
      </div>
    );
  }

  if (error && !shareData?.requires_password) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-white mb-2">Link not found</h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Password gate
  if (shareData?.requires_password && !shareData.presentation) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">🔒</div>
            <h1 className="text-xl font-bold text-white">Password protected</h1>
            <p className="text-slate-400 text-sm mt-1">Enter the password to view this presentation.</p>
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            placeholder="Enter password"
            className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
          />
          <button
            onClick={handleUnlock}
            disabled={unlocking || !password}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition"
          >
            {unlocking ? "Verifying…" : "View presentation"}
          </button>
        </div>
      </div>
    );
  }

  const presentation = shareData?.presentation;
  if (!presentation) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-slate-900">{presentation.title || "Untitled presentation"}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{presentation.n_slides} slides</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{shareData?.view_count ?? 0} views</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Read only</span>
        </div>
      </header>

      {/* Presentation content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {presentation.structure ? (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <p className="text-xs text-slate-400 mb-2 uppercase tracking-wide font-medium">Presentation Data</p>
              <p className="text-sm text-slate-700">
                {presentation.n_slides} slides • {presentation.title}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Full slide rendering requires opening in the app.{" "}
                <a href="/" className="text-indigo-500 hover:text-indigo-600 underline">
                  Sign in to view →
                </a>
              </p>
            </div>

            {/* Slide list */}
            {Array.isArray((presentation.structure as { slides?: unknown[] })?.slides) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {((presentation.structure as { slides: { title?: string; headline?: string }[] }).slides ?? []).map(
                  (slide, i) => (
                    <div
                      key={i}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
                    >
                      <p className="text-xs text-slate-400 mb-1">Slide {i + 1}</p>
                      <p className="font-medium text-slate-800 text-sm">
                        {slide.title ?? slide.headline ?? `Slide ${i + 1}`}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">
            <p>Presentation content not available for preview.</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-slate-400">
        Shared via{" "}
        <a href="/" className="text-indigo-500 hover:text-indigo-600">
          Unslid
        </a>
      </footer>
    </div>
  );
}
