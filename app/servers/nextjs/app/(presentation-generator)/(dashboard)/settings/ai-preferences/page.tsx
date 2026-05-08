"use client";

import { useState, useEffect } from "react";
import { api, UserProfile } from "@/lib/api";
import { Cpu, Image as ImageIcon, Info } from "lucide-react";

interface PlanAIConfig {
  plan: string;
  llm_provider: string;
  llm_model: string;
  llm_api_key_set: boolean;
  llm_base_url: string | null;
  image_provider: string;
  image_model: string | null;
  image_api_key_set: boolean;
  user_can_override_llm: boolean;
  user_can_override_image: boolean;
}

interface AIPreferences {
  llm_provider: string | null;
  llm_model: string | null;
  llm_base_url: string | null;
  image_provider: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  google: "Google Gemini",
  anthropic: "Anthropic Claude",
  ollama: "Ollama (local)",
  custom: "Custom (OpenAI-compatible)",
  pexels: "Pexels (stock photos)",
  pixabay: "Pixabay (stock photos)",
  none: "No images",
};

export default function AIPreferencesPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [planConfig, setPlanConfig] = useState<PlanAIConfig | null>(null);
  const [prefs, setPrefs] = useState<AIPreferences>({
    llm_provider: null,
    llm_model: null,
    llm_base_url: null,
    image_provider: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<UserProfile>("/api/v1/account/me"),
      api.get<AIPreferences>("/api/v1/account/ai-preferences"),
    ]).then(([u, p]) => {
      setUser(u);
      setPrefs(p);
      // Load plan config to know what overrides are allowed
      return api.get<PlanAIConfig[]>("/api/v1/admin/ai-config").catch(() => null);
    }).then((configs) => {
      if (configs && user) {
        const cfg = configs.find((c) => c.plan === user.plan);
        if (cfg) setPlanConfig(cfg);
      }
    }).catch(() => setError("Failed to load preferences"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-load plan config when user is set
  useEffect(() => {
    if (!user) return;
    api.get<PlanAIConfig[]>("/api/v1/admin/ai-config").then((configs) => {
      const cfg = configs.find((c) => c.plan === user.plan);
      if (cfg) setPlanConfig(cfg);
    }).catch(() => {});
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/v1/account/ai-preferences", prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-slate-500 text-sm">Loading…</div>;

  const isPaid = user?.plan === "pro" || user?.plan === "team";
  const canOverrideLlm = isPaid && planConfig?.user_can_override_llm;
  const canOverrideImage = isPaid && planConfig?.user_can_override_image;

  return (
    <div className="max-w-2xl mx-auto px-8 py-10 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">AI Preferences</h1>
      <p className="text-sm text-slate-500 -mt-6">
        Customize which AI model generates your presentations. Available settings depend on your plan and what your administrator has enabled.
      </p>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {!isPaid && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 text-sm text-violet-800 flex items-start gap-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-1">Available on Pro & Team plans</p>
            <p>Upgrade to choose your preferred AI model and image provider.</p>
            <a href="/settings/billing" className="underline font-semibold mt-1 inline-block">Upgrade →</a>
          </div>
        </div>
      )}

      {/* Current plan defaults */}
      <section className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-slate-500" />
          Plan defaults (set by admin)
        </h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Text / LLM provider</p>
            <p className="font-medium text-slate-800">{PROVIDER_LABELS[planConfig?.llm_provider ?? ""] ?? planConfig?.llm_provider ?? "Not configured"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">LLM model</p>
            <p className="font-medium text-slate-800 font-mono text-xs">{planConfig?.llm_model ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Image provider</p>
            <p className="font-medium text-slate-800">{PROVIDER_LABELS[planConfig?.image_provider ?? ""] ?? planConfig?.image_provider ?? "Not configured"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">User overrides</p>
            <p className="font-medium text-slate-800">
              {canOverrideLlm || canOverrideImage ? (
                <span className="text-green-700">Enabled by admin</span>
              ) : (
                <span className="text-slate-500">Not available for your plan</span>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* LLM Override */}
      {canOverrideLlm && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-slate-500" />
            Text / LLM preference
          </h2>
          <p className="text-xs text-slate-500">
            Leave blank to use the plan default. Your selection will be used for all presentations.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Provider</label>
            <select
              value={prefs.llm_provider ?? ""}
              onChange={(e) => setPrefs((p) => ({ ...p, llm_provider: e.target.value || null, llm_model: null }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Use plan default ({PROVIDER_LABELS[planConfig?.llm_provider ?? ""] ?? planConfig?.llm_provider})</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="ollama">Ollama (local)</option>
              <option value="custom">Custom (OpenAI-compatible)</option>
            </select>
          </div>
          {prefs.llm_provider && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
              <input
                type="text"
                value={prefs.llm_model ?? ""}
                onChange={(e) => setPrefs((p) => ({ ...p, llm_model: e.target.value || null }))}
                placeholder={`e.g. ${prefs.llm_provider === "openai" ? "gpt-4.1-mini" : prefs.llm_provider === "google" ? "gemini-2.0-flash" : "claude-3-5-haiku"}`}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          )}
          {(prefs.llm_provider === "ollama" || prefs.llm_provider === "custom") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Base URL</label>
              <input
                type="url"
                value={prefs.llm_base_url ?? ""}
                onChange={(e) => setPrefs((p) => ({ ...p, llm_base_url: e.target.value || null }))}
                placeholder={prefs.llm_provider === "ollama" ? "http://localhost:11434" : "https://api.example.com/v1"}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          )}
        </section>
      )}

      {/* Image Override */}
      {canOverrideImage && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-500" />
            Image preference
          </h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Image provider</label>
            <select
              value={prefs.image_provider ?? ""}
              onChange={(e) => setPrefs((p) => ({ ...p, image_provider: e.target.value || null }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Use plan default ({PROVIDER_LABELS[planConfig?.image_provider ?? ""] ?? planConfig?.image_provider})</option>
              <option value="pexels">Pexels (stock photos — free)</option>
              <option value="pixabay">Pixabay (stock photos — free)</option>
              <option value="openai">OpenAI DALL·E (AI-generated)</option>
              <option value="google">Google Imagen (AI-generated)</option>
              <option value="none">No images</option>
            </select>
          </div>
        </section>
      )}

      {(canOverrideLlm || canOverrideImage) && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save preferences"}
        </button>
      )}
    </div>
  );
}
