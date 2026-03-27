"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, UserProfile } from "@/lib/api";
import { Eye, EyeOff, Save, ChevronDown, Cpu, Tag, LayoutTemplate, Lock, Unlock, Loader2 as Loader2Icon, BarChart2 } from "lucide-react";
import Link from "next/link";

interface PlatformStats {
  users: {
    total: number;
    active: number;
    inactive: number;
    by_plan: { free: number; pro: number; team: number };
    by_region: { eu: number; us: number };
  };
  organizations: { total: number };
  presentations: { total: number };
  generated_at: string;
}

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  plan: string;
  storage_region: string;
  is_active: boolean;
  is_admin: boolean;
  storage_used_bytes: number;
  created_at: string;
}

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
  updated_at: string | null;
}

interface PlanPricingEntry {
  price_monthly: number;
  price_annual: number;
  currency: string;
  stripe_price_id_monthly: string;
  stripe_price_id_annual: string;
  features: string[];
}

interface PlanPricing {
  free: PlanPricingEntry;
  pro: PlanPricingEntry;
  team: PlanPricingEntry;
}

interface TrialConfig {
  name: string;
  days: number;
  price: number;
  currency: string;
  stripe_price_id: string;
  features: string[];
}

interface UsageMonitorUser {
  id: number;
  email: string;
  full_name: string;
  plan: string;
  presentations_this_month: number;
  tokens_estimated_this_month: number;
  images_this_month: number;
  active_ips: string[];
  active_session_count: number;
}

const DEFAULT_TRIAL_CONFIG: TrialConfig = {
  name: "Spark",
  days: 7,
  price: 9.90,
  currency: "USD",
  stripe_price_id: "",
  features: [
    "7日間のフルProアクセス",
    "プレミアムAIモデル（GPT-4、Claude、Gemini）",
    "試用中無制限プレゼン",
    "PPTX & PDFエクスポート",
    "サブスクリプションなし — 一回払い",
  ],
};

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
  created_at: string;
  updated_at: string;
}

interface TemplateTierEntry {
  id: number;
  template_id: string;
  name: string;
  tier: "free" | "premium";
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

const DEFAULT_PLAN_PRICING: PlanPricing = {
  free: { price_monthly: 0, price_annual: 0, currency: "USD", stripe_price_id_monthly: "", stripe_price_id_annual: "", features: ["月5プレゼン", "同時生成1件", "全テンプレート", "PDF & PPTXエクスポート", "コミュニティサポート"] },
  pro:  { price_monthly: 19, price_annual: 190, currency: "USD", stripe_price_id_monthly: "", stripe_price_id_annual: "", features: ["無制限プレゼン", "同時生成3件", "全テンプレート", "PDF & PPTXエクスポート", "APIアクセス", "優先サポート"] },
  team: { price_monthly: 49, price_annual: 490, currency: "USD", stripe_price_id_monthly: "", stripe_price_id_annual: "", features: ["無制限プレゼン", "同時生成5件", "全テンプレート", "PDF & PPTXエクスポート", "チームワークスペース", "APIアクセス", "専任サポート"] },
};

const PLAN_BADGE: Record<string, string> = {
  free: "bg-slate-100 text-slate-600",
  pro: "bg-indigo-100 text-indigo-700",
  team: "bg-purple-100 text-purple-700",
};

const PLAN_LABELS: Record<string, string> = {
  free: "無料",
  pro: "Pro",
  team: "チーム",
};

// ─── Provider catalog types (fetched from backend) ───────────────────────────

interface AIModel {
  id: string;
  label: string;
  notes?: string;
  recommended_for?: string[];
}

interface AIProvider {
  id: string;
  label: string;
  type: "native" | "compatible";
  provider_backend: string;
  base_url: string | null;
  needs_base_url: boolean;
  api_key_url: string | null;
  models: AIModel[];
}

interface ImageProvider {
  id: string;
  label: string;
  needs_api_key: boolean;
  api_key_url: string | null;
  base_url?: string;
}

interface ProviderCatalog {
  llm_providers: AIProvider[];
  image_providers: ImageProvider[];
}

/** Given backend provider + base_url, find the matching catalog entry */
function resolveUIProvider(
  backendProvider: string,
  baseUrl: string | null,
  catalog: AIProvider[],
): AIProvider | undefined {
  if (backendProvider !== "custom") {
    return catalog.find((p) => p.provider_backend === backendProvider && p.type === "native");
  }
  // For custom/compatible, match by base_url
  if (baseUrl) {
    const match = catalog.find(
      (p) => p.type === "compatible" && p.base_url && baseUrl.startsWith(p.base_url.replace("YOUR-RESOURCE", "").split("{")[0]),
    );
    if (match) return match;
  }
  return catalog.find((p) => p.id === "kimi"); // fallback to first compatible
}

// ─── AI Config Panel ─────────────────────────────────────────────────────────

function SelectBox({
  value,
  onChange,
  children,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full appearance-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-8 bg-white disabled:bg-slate-50 disabled:text-slate-400"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

function PlanAIConfigCard({
  config,
  catalog,
  onSave,
}: {
  config: PlanAIConfig;
  catalog: ProviderCatalog | null;
  onSave: (plan: string, data: Record<string, string | null>) => Promise<void>;
}) {
  // Resolve which UI provider matches the saved backend config
  // selectedProviderId is the UI-level provider id (e.g. "kimi", not "custom")
  // Initialized to config.llm_provider as a fallback; corrected once catalog loads.
  const [selectedProviderId, setSelectedProviderId] = useState<string>(config.llm_provider);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [llmModel, setLlmModel] = useState(config.llm_model);
  const [llmApiKey, setLlmApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [llmBaseUrl, setLlmBaseUrl] = useState(config.llm_base_url ?? "");
  const [imageProviderId, setImageProviderId] = useState(config.image_provider);
  const [imageApiKey, setImageApiKey] = useState("");
  const [showImageKey, setShowImageKey] = useState(false);
  const [userCanOverrideLlm, setUserCanOverrideLlm] = useState(config.user_can_override_llm ?? false);
  const [userCanOverrideImage, setUserCanOverrideImage] = useState(config.user_can_override_image ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once catalog arrives, resolve the correct UI provider id from the saved backend config.
  // Only do this once — afterwards the user controls the dropdown themselves.
  useEffect(() => {
    if (catalog && !catalogLoaded) {
      setCatalogLoaded(true);
      const p = resolveUIProvider(config.llm_provider, config.llm_base_url, catalog.llm_providers);
      if (p) setSelectedProviderId(p.id);
    }
  }, [catalog, catalogLoaded, config.llm_provider, config.llm_base_url]);

  const llmProviders = catalog?.llm_providers ?? [];
  const imageProviders = catalog?.image_providers ?? [];
  const currentProvider = llmProviders.find((p) => p.id === selectedProviderId);
  const currentImageProvider = imageProviders.find((p) => p.id === imageProviderId);

  const nativeProviders = llmProviders.filter((p) => p.type === "native");
  const compatibleProviders = llmProviders.filter((p) => p.type === "compatible");

  const handleProviderChange = (newId: string) => {
    setSelectedProviderId(newId);
    const p = llmProviders.find((x) => x.id === newId);
    if (p) {
      // Auto-pick first model
      setLlmModel(p.models[0]?.id ?? "");
      // Auto-fill base URL
      if (p.needs_base_url && p.base_url) setLlmBaseUrl(p.base_url);
      else setLlmBaseUrl("");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(config.plan, {
        llm_provider: currentProvider?.provider_backend ?? selectedProviderId,
        llm_model: llmModel,
        llm_api_key: llmApiKey || null,
        llm_base_url: currentProvider?.needs_base_url ? (llmBaseUrl || null) : null,
        image_provider: imageProviderId,
        image_model: null,
        image_api_key: imageApiKey || null,
        user_can_override_llm: userCanOverrideLlm,
        user_can_override_image: userCanOverrideImage,
      });
      setSaved(true);
      setLlmApiKey("");
      setImageApiKey("");
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const planColor: Record<string, string> = {
    free: "border-slate-200",
    pro: "border-indigo-200",
    team: "border-purple-200",
  };

  return (
    <div className={`bg-white border-2 ${planColor[config.plan] ?? "border-slate-200"} rounded-xl p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-slate-400" />
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${PLAN_BADGE[config.plan]}`}>
            {PLAN_LABELS[config.plan]}プラン
          </span>
        </div>
        {config.updated_at && (
          <span className="text-[10px] text-slate-400">
            {new Date(config.updated_at).toLocaleDateString()}更新
          </span>
        )}
      </div>

      {/* LLM Provider dropdown — grouped */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">LLMプロバイダー</label>
        {!catalog ? (
          <div className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400 bg-slate-50">
            プロバイダーを読み込み中...
          </div>
        ) : (
          <SelectBox value={selectedProviderId} onChange={handleProviderChange}>
            <optgroup label="── ネイティブプロバイダー ──────────">
              {nativeProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="── OpenAI互換 ─────────">
              {compatibleProviders.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          </SelectBox>
        )}
        {currentProvider?.type === "compatible" && (
          <p className="text-[10px] text-slate-400 mt-1">OpenAI互換APIを使用 — ベースURLは以下に自動入力されます</p>
        )}
      </div>

      {/* Model dropdown */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">モデル</label>
        {currentProvider && currentProvider.models.length > 0 ? (
          <>
            <SelectBox value={llmModel} onChange={setLlmModel}>
              {currentProvider.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.recommended_for?.includes(config.plan) ? " ★" : ""}
                  {m.notes ? ` — ${m.notes}` : ""}
                </option>
              ))}
            </SelectBox>
            <p className="text-[10px] text-slate-400 mt-1">★ = このプランに推奨</p>
          </>
        ) : (
          <input
            type="text"
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
              placeholder="モデルIDを入力"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
      </div>

      {/* API Key */}
      {currentProvider?.id !== "ollama" && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            APIキー{" "}
            {config.llm_api_key_set && <span className="text-green-600 font-normal">（設定済み — 暗号化済み ✓）</span>}
          </label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={llmApiKey}
              onChange={(e) => setLlmApiKey(e.target.value)}
              placeholder={config.llm_api_key_set ? "変更しない場合は空白のままにしてください" : "APIキーを貼り付け..."}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {currentProvider?.api_key_url && (
            <a
              href={currentProvider.api_key_url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-indigo-500 hover:underline mt-0.5 inline-block"
            >
              APIキーを取得 →
            </a>
          )}
        </div>
      )}

      {/* Base URL */}
      {currentProvider?.needs_base_url && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">ベースURL</label>
          <input
            type="url"
            value={llmBaseUrl}
            onChange={(e) => setLlmBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
          />
        </div>
      )}

      {/* Image provider */}
      <div className="border-t border-slate-100 pt-4">
        <label className="block text-xs font-medium text-slate-700 mb-1">画像プロバイダー</label>
        <SelectBox value={imageProviderId} onChange={setImageProviderId}>
          {imageProviders.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </SelectBox>
      </div>

      {/* Image API Key (if needed) */}
      {currentImageProvider?.needs_api_key && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            画像APIキー{" "}
            {config.image_api_key_set && <span className="text-green-600 font-normal">（設定済み — 暗号化済み ✓）</span>}
          </label>
          <div className="relative">
            <input
              type={showImageKey ? "text" : "password"}
              value={imageApiKey}
              onChange={(e) => setImageApiKey(e.target.value)}
              placeholder={config.image_api_key_set ? "変更しない場合は空白のままにしてください" : "画像APIキーを貼り付け..."}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowImageKey((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showImageKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {currentImageProvider?.api_key_url && (
            <a
              href={currentImageProvider.api_key_url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-indigo-500 hover:underline mt-0.5 inline-block"
            >
              画像APIキーを取得 →
            </a>
          )}
        </div>
      )}

      {/* User override toggles */}
      {config.plan !== "free" && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <p className="text-xs font-medium text-slate-700 mb-1">ユーザー設定</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={userCanOverrideLlm}
              onChange={(e) => setUserCanOverrideLlm(e.target.checked)}
              className="accent-indigo-500"
            />
            <span className="text-xs text-slate-600">ユーザーが自分のLLMモデルを選択できるようにする</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={userCanOverrideImage}
              onChange={(e) => setUserCanOverrideImage(e.target.checked)}
              className="accent-indigo-500"
            />
            <span className="text-xs text-slate-600">ユーザーが自分の画像プロバイダーを選択できるようにする</span>
          </label>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${
          saved ? "bg-green-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
        } disabled:opacity-50`}
      >
        <Save className="h-4 w-4" />
        {saving ? "保存中…" : saved ? "保存済み！" : "設定を保存"}
      </button>
    </div>
  );
}

// ─── Plan Pricing Card ────────────────────────────────────────────────────────

function PlanPricingCard({
  planKey,
  entry,
  onChange,
}: {
  planKey: "free" | "pro" | "team";
  entry: PlanPricingEntry;
  onChange: (updated: PlanPricingEntry) => void;
}) {
  const planColor: Record<string, string> = {
    free: "border-slate-200",
    pro: "border-indigo-200",
    team: "border-purple-200",
  };

  const update = (field: keyof PlanPricingEntry, value: string | number | string[]) =>
    onChange({ ...entry, [field]: value });

  return (
    <div className={`bg-white border-2 ${planColor[planKey]} rounded-xl p-5 space-y-4`}>
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-slate-400" />
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${PLAN_BADGE[planKey]}`}>
          {PLAN_LABELS[planKey]}プラン
        </span>
        {planKey === "free" && (
          <span className="text-xs text-slate-400 ml-auto">永久無料</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">月額</label>
          <div className="flex">
            <span className="px-2.5 py-2 text-sm bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg text-slate-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={entry.price_monthly}
              onChange={(e) => update("price_monthly", parseFloat(e.target.value) || 0)}
              disabled={planKey === "free"}
              className="flex-1 border border-slate-300 rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">年額</label>
          <div className="flex">
            <span className="px-2.5 py-2 text-sm bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg text-slate-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={entry.price_annual}
              onChange={(e) => update("price_annual", parseFloat(e.target.value) || 0)}
              disabled={planKey === "free"}
              className="flex-1 border border-slate-300 rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          {entry.price_monthly > 0 && entry.price_annual > 0 && (
            <p className="text-[10px] text-green-600 mt-0.5">
              月額比{Math.round((1 - entry.price_annual / (entry.price_monthly * 12)) * 100)}%割引
            </p>
          )}
        </div>
      </div>

      {planKey !== "free" && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Stripe価格ID — 月額</label>
            <input
              type="text"
              placeholder="price_1ABC…"
              value={entry.stripe_price_id_monthly}
              onChange={(e) => update("stripe_price_id_monthly", e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Stripe価格ID — 年額</label>
            <input
              type="text"
              placeholder="price_1XYZ…"
              value={entry.stripe_price_id_annual}
              onChange={(e) => update("stripe_price_id_annual", e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">機能（1行につき1項目）</label>
        <textarea
          rows={5}
          value={entry.features.join("\n")}
          onChange={(e) => update("features", e.target.value.split("\n"))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <p className="text-[10px] text-slate-400 mt-0.5">請求アップグレードカードに表示されます</p>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [billingStats, setBillingStats] = useState<{ pro_users: number; team_users: number; past_due_accounts: number; total_team_seats_sold: number } | null>(null);
  const [failedPayments, setFailedPayments] = useState<AdminUser[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [aiConfigs, setAiConfigs] = useState<PlanAIConfig[]>([]);
  const [providerCatalog, setProviderCatalog] = useState<ProviderCatalog | null>(null);
  const [planPricing, setPlanPricing] = useState<PlanPricing>(DEFAULT_PLAN_PRICING);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSaved, setPricingSaved] = useState(false);
  const [trialConfig, setTrialConfig] = useState<TrialConfig>(DEFAULT_TRIAL_CONFIG);
  const [trialSaving, setTrialSaving] = useState(false);
  const [trialSaved, setTrialSaved] = useState(false);
  const [usageMonitor, setUsageMonitor] = useState<UsageMonitorUser[]>([]);
  const [usageMonitorLoading, setUsageMonitorLoading] = useState(false);
  const [stripeConfig, setStripeConfig] = useState<{ publishable_key: string; secret_key_set: boolean; webhook_secret_set: boolean; mode: string } | null>(null);
  const [stripePublishableKey, setStripePublishableKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [stripeMode, setStripeMode] = useState<"test" | "live">("test");
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showStripeWebhook, setShowStripeWebhook] = useState(false);
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeSaved, setStripeSaved] = useState(false);
  // Mailgun
  const [mailgunConfig, setMailgunConfig] = useState<{ domain: string; from_email: string; from_name: string; api_key_set: boolean; region: string } | null>(null);
  const [mailgunDomain, setMailgunDomain] = useState("");
  const [mailgunFromEmail, setMailgunFromEmail] = useState("");
  const [mailgunFromName, setMailgunFromName] = useState("Unslid");
  const [mailgunApiKey, setMailgunApiKey] = useState("");
  const [mailgunRegion, setMailgunRegion] = useState<"us" | "eu">("us");
  const [showMailgunKey, setShowMailgunKey] = useState(false);
  const [mailgunSaving, setMailgunSaving] = useState(false);
  const [mailgunSaved, setMailgunSaved] = useState(false);
  const [mailgunTesting, setMailgunTesting] = useState(false);
  const [mailgunTestResult, setMailgunTestResult] = useState<string | null>(null);
  const [templateTiers, setTemplateTiers] = useState<TemplateTierEntry[]>([]);
  const [templateTierSaving, setTemplateTierSaving] = useState<string | null>(null);
  const [pptxTemplates, setPptxTemplates] = useState<PptxDesignerTemplate[]>([]);
  const [pptxUploading, setPptxUploading] = useState(false);
  const [pptxUploadName, setPptxUploadName] = useState("");
  const [pptxUploadDesc, setPptxUploadDesc] = useState("");
  const [pptxUploadTier, setPptxUploadTier] = useState<"free" | "premium">("free");
  const [pptxUploadFile, setPptxUploadFile] = useState<File | null>(null);
  const [pptxSaving, setPptxSaving] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [changingPlan, setChangingPlan] = useState<number | null>(null);
  const [dbOffline, setDbOffline] = useState(false);

  useEffect(() => {
    api.get<UserProfile>("/api/v1/account/me")
      .then((u) => {
        if (!u.is_admin) {
          router.replace("/dashboard");
          return;
        }
        setCurrentUser(u);
        // Use allSettled so a single failing call doesn't wipe out everything
        Promise.allSettled([
          api.get<PlatformStats>("/api/v1/admin/stats"),
          api.get<AdminUser[]>("/api/v1/admin/users"),
          api.get<PlanAIConfig[]>("/api/v1/admin/ai-config"),
          api.get<PlanPricing>("/api/v1/admin/plan-pricing"),
          api.get<ProviderCatalog>("/api/v1/admin/ai-providers"),
          api.get<any>("/api/v1/admin/billing-stats"),
          api.get<AdminUser[]>("/api/v1/admin/failed-payments"),
          api.get<any>("/api/v1/admin/stripe-config"),
          api.get<TemplateTierEntry[]>("/api/v1/admin/template-tiers"),
          api.get<PptxDesignerTemplate[]>("/api/v1/admin/pptx-templates"),
          api.get<TrialConfig>("/api/v1/admin/trial-config"),
          api.get<any>("/api/v1/admin/mailgun-config"),
        ]).then(([statsRes, usersRes, aiRes, pricingRes, catalogRes, billingStatsRes, failedRes, stripeRes, tierRes, pptxRes, trialRes, mailgunRes]) => {
          if (statsRes.status === "fulfilled") setStats(statsRes.value);
          if (usersRes.status === "fulfilled") setUsers(usersRes.value);
          if (pricingRes.status === "fulfilled") setPlanPricing(pricingRes.value);
          if (catalogRes.status === "fulfilled") setProviderCatalog(catalogRes.value);
          if (billingStatsRes.status === "fulfilled") setBillingStats(billingStatsRes.value);
          if (failedRes.status === "fulfilled") setFailedPayments(failedRes.value);
          if (stripeRes.status === "fulfilled") {
            const sc = stripeRes.value;
            setStripeConfig(sc);
            setStripePublishableKey(sc.publishable_key ?? "");
            setStripeMode(sc.mode ?? "test");
          }
          if (tierRes.status === "fulfilled") setTemplateTiers(tierRes.value);
          if (pptxRes.status === "fulfilled") setPptxTemplates(pptxRes.value);
          if (trialRes.status === "fulfilled") setTrialConfig(trialRes.value);
          if (mailgunRes.status === "fulfilled") {
            const mg = mailgunRes.value;
            setMailgunConfig(mg);
            setMailgunDomain(mg.domain ?? "");
            setMailgunFromEmail(mg.from_email ?? "");
            setMailgunFromName(mg.from_name ?? "Unslid");
            setMailgunRegion(mg.region ?? "us");
          }
          if (aiRes.status === "fulfilled") {
            setAiConfigs(aiRes.value);
          } else {
            // DB offline — show empty default cards so the UI is still visible
            setAiConfigs([
              { plan: "free",  llm_provider: "openai", llm_model: "gpt-4.1-mini", llm_api_key_set: false, llm_base_url: null, image_provider: "pexels", image_model: null, image_api_key_set: false, user_can_override_llm: false, user_can_override_image: false, updated_at: null },
              { plan: "pro",   llm_provider: "openai", llm_model: "gpt-4.1",      llm_api_key_set: false, llm_base_url: null, image_provider: "pexels", image_model: null, image_api_key_set: false, user_can_override_llm: false, user_can_override_image: false, updated_at: null },
              { plan: "team",  llm_provider: "openai", llm_model: "gpt-4.1",      llm_api_key_set: false, llm_base_url: null, image_provider: "pexels", image_model: null, image_api_key_set: false, user_can_override_llm: false, user_can_override_image: false, updated_at: null },
            ]);
            setDbOffline(true);
          }
        });
      })
      .catch(() => router.replace("/dashboard"))
      .finally(() => setLoading(false));
  }, [router]);

  const searchUsers = async () => {
    setUsersLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (planFilter) params.set("plan", planFilter);
    const result = await api.get<AdminUser[]>(`/api/v1/admin/users?${params}`);
    setUsers(result);
    setUsersLoading(false);
  };

  const handleChangePlan = async (userId: number, plan: string) => {
    setChangingPlan(userId);
    await api.put(`/api/v1/admin/users/${userId}/plan`, { plan });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, plan } : u));
    setChangingPlan(null);
  };

  const handleUpdateTemplateTier = async (templateId: string, updates: Partial<TemplateTierEntry>) => {
    setTemplateTierSaving(templateId);
    try {
      const updated = await api.put<TemplateTierEntry>(`/api/v1/admin/template-tiers/${templateId}`, updates);
      setTemplateTiers((prev) => prev.map((t) => t.template_id === templateId ? { ...t, ...updated } : t));
    } catch {
      alert("テンプレートティアの更新に失敗しました。もう一度お試しください。");
    } finally {
      setTemplateTierSaving(null);
    }
  };

  const handleUploadPptxTemplate = async () => {
    if (!pptxUploadName.trim() || !pptxUploadFile) {
      alert("名前と.pptxファイルを選択してください。");
      return;
    }
    setPptxUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", pptxUploadName.trim());
      formData.append("description", pptxUploadDesc.trim());
      formData.append("tier", pptxUploadTier);
      formData.append("file", pptxUploadFile);
      const result = await api.postFormData<PptxDesignerTemplate>("/api/v1/admin/pptx-templates", formData);
      setPptxTemplates((prev) => [...prev, result]);
      setPptxUploadName("");
      setPptxUploadDesc("");
      setPptxUploadTier("free");
      setPptxUploadFile(null);
    } catch (e: any) {
      alert("アップロードに失敗しました: " + (e?.message ?? "不明なエラー"));
    } finally {
      setPptxUploading(false);
    }
  };

  const handleUpdatePptxTemplate = async (id: number, updates: Partial<PptxDesignerTemplate>) => {
    setPptxSaving(id);
    try {
      const updated = await api.put<PptxDesignerTemplate>(`/api/v1/admin/pptx-templates/${id}`, updates);
      setPptxTemplates((prev) => prev.map((t) => t.id === id ? { ...t, ...updated } : t));
    } catch {
      alert("テンプレートの更新に失敗しました。もう一度お試しください。");
    } finally {
      setPptxSaving(null);
    }
  };

  const handleDeletePptxTemplate = async (id: number) => {
    if (!confirm("このデザイナーテンプレートを削除しますか？この操作は取り消せません。")) return;
    try {
      await api.delete(`/api/v1/admin/pptx-templates/${id}`);
      setPptxTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      alert("テンプレートの削除に失敗しました。");
    }
  };

  const handleDeactivate = async (userId: number) => {
    await api.post(`/api/v1/admin/users/${userId}/deactivate`);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: false } : u));
  };

  const handleActivate = async (userId: number) => {
    await api.post(`/api/v1/admin/users/${userId}/activate`);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: true } : u));
  };

  const handleSaveStripeConfig = async () => {
    setStripeSaving(true);
    try {
      const updated = await api.put<any>("/api/v1/admin/stripe-config", {
        publishable_key: stripePublishableKey,
        secret_key: stripeSecretKey || undefined,
        webhook_secret: stripeWebhookSecret || undefined,
        mode: stripeMode,
      });
      setStripeConfig(updated);
      setStripeSecretKey("");
      setStripeWebhookSecret("");
      setStripeSaved(true);
      setTimeout(() => setStripeSaved(false), 2500);
    } catch {
      alert("Stripe設定の保存に失敗しました。もう一度お試しください。");
    } finally {
      setStripeSaving(false);
    }
  };

  const handleSaveMailgunConfig = async () => {
    setMailgunSaving(true);
    setMailgunTestResult(null);
    try {
      const updated = await api.put<any>("/api/v1/admin/mailgun-config", {
        domain: mailgunDomain,
        from_email: mailgunFromEmail,
        from_name: mailgunFromName,
        api_key: mailgunApiKey || undefined,
        region: mailgunRegion,
      });
      setMailgunConfig(updated);
      setMailgunApiKey("");
      setMailgunSaved(true);
      setTimeout(() => setMailgunSaved(false), 2500);
    } catch {
      alert("Mailgun設定の保存に失敗しました。もう一度お試しください。");
    } finally {
      setMailgunSaving(false);
    }
  };

  const handleTestMailgun = async () => {
    setMailgunTesting(true);
    setMailgunTestResult(null);
    try {
      await api.post<any>("/api/v1/admin/mailgun-config/test", {});
      setMailgunTestResult("success");
    } catch {
      setMailgunTestResult("error");
    } finally {
      setMailgunTesting(false);
    }
  };

  const handleSavePlanPricing = async () => {
    setPricingSaving(true);
    try {
      const updated = await api.put<PlanPricing>("/api/v1/admin/plan-pricing", planPricing);
      setPlanPricing(updated);
      setPricingSaved(true);
      setTimeout(() => setPricingSaved(false), 2500);
    } catch {
      alert("料金の保存に失敗しました。もう一度お試しください。");
    } finally {
      setPricingSaving(false);
    }
  };

  const handleLoadUsageMonitor = async () => {
    setUsageMonitorLoading(true);
    try {
      const data = await api.get<{ users: UsageMonitorUser[] }>("/api/v1/admin/usage-monitor");
      setUsageMonitor(data.users);
    } catch {
      alert("使用状況モニターの読み込みに失敗しました。もう一度お試しください。");
    } finally {
      setUsageMonitorLoading(false);
    }
  };

  const handleSaveTrialConfig = async () => {
    setTrialSaving(true);
    try {
      const updated = await api.put<TrialConfig>("/api/v1/admin/trial-config", trialConfig);
      setTrialConfig(updated);
      setTrialSaved(true);
      setTimeout(() => setTrialSaved(false), 2500);
    } catch {
      alert("試用設定の保存に失敗しました。もう一度お試しください。");
    } finally {
      setTrialSaving(false);
    }
  };

  const handleSaveAIConfig = async (plan: string, data: Record<string, string | null>) => {
    if (dbOffline) {
      throw new Error("データベースがオフラインです — DBを接続してからキーを保存してください。");
    }
    const updated = await api.put<PlanAIConfig>(`/api/v1/admin/ai-config/${plan}`, data);
    setAiConfigs((prev) => prev.map((c) => c.plan === plan ? updated : c));
  };

  const formatBytes = (b: number) => {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400 text-sm">管理者ページを読み込み中...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-slate-400 hover:text-slate-600 transition">
            ← ダッシュボード
          </button>
          <h1 className="text-lg font-bold text-slate-900">管理者</h1>
        </div>
        <span className="text-xs text-slate-400">ログイン中: {currentUser?.email}</span>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="総ユーザー数" value={stats.users.total} />
            <StatCard label="アクティブユーザー" value={stats.users.active} />
            <StatCard label="組織" value={stats.organizations.total} />
            <StatCard label="プレゼン数" value={stats.presentations.total} />
          </div>
        )}

        {/* Growth analytics shortcut */}
        <Link
          href="/admin/stats"
          className="flex items-center justify-between w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl px-5 py-4 shadow-sm hover:opacity-90 transition"
        >
          <div className="flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-indigo-200" />
            <div>
              <p className="font-semibold text-sm">成長分析ダッシュボード</p>
              <p className="text-indigo-200 text-xs">サインアップトレンド、アクティベーション率、UTMアトリビューション、MRR見積もり</p>
            </div>
          </div>
          <span className="text-indigo-200 text-sm">表示 →</span>
        </Link>

        {/* Plan breakdown */}
        {stats && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-semibold text-slate-800 mb-4">プラン別ユーザー</h2>
            <div className="grid grid-cols-3 gap-4">
              {(["free", "pro", "team"] as const).map((plan) => (
                <div key={plan} className="text-center">
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold mb-1 ${PLAN_BADGE[plan]}`}>
                    {PLAN_LABELS[plan]}
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{stats.users.by_plan[plan]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Billing stats */}
        {billingStats && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">請求概要</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Proサブスクライバー</p>
                <p className="text-2xl font-bold text-slate-900">{billingStats.pro_users}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">チームサブスクライバー</p>
                <p className="text-2xl font-bold text-slate-900">{billingStats.team_users}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">チームシート販売数</p>
                <p className="text-2xl font-bold text-slate-900">{billingStats.total_team_seats_sold}</p>
              </div>
              <div className={`rounded-lg p-4 text-center ${billingStats.past_due_accounts > 0 ? "bg-red-50" : "bg-slate-50"}`}>
                <p className={`text-xs mb-1 ${billingStats.past_due_accounts > 0 ? "text-red-600" : "text-slate-500"}`}>期限切れアカウント</p>
                <p className={`text-2xl font-bold ${billingStats.past_due_accounts > 0 ? "text-red-700" : "text-slate-900"}`}>{billingStats.past_due_accounts}</p>
              </div>
            </div>
          </div>
        )}

        {/* Failed payments list */}
        {failedPayments.length > 0 && (
          <div className="bg-white border border-red-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-red-700">支払い失敗 — 対応が必要です</h2>
            <ul className="divide-y divide-slate-100">
              {failedPayments.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{u.full_name || u.email}</p>
                    <p className="text-xs text-slate-400">{u.email} · {u.plan}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">期限切れ</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Usage Monitor (Abuse Detection) ─────────────────────────────── */}
        <div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-semibold text-slate-800 text-lg">使用状況モニター</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                今月のアクティビティ上位ユーザー。複数の同時IPや異常に高い生成回数はアカウント共有を示している可能性があります。
              </p>
            </div>
            <button
              onClick={handleLoadUsageMonitor}
              disabled={usageMonitorLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition disabled:opacity-50"
            >
              <BarChart2 className="h-4 w-4" />
              {usageMonitorLoading ? "読み込み中..." : usageMonitor.length > 0 ? "更新" : "使用データを読み込む"}
            </button>
          </div>
          {usageMonitor.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ユーザー</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">プラン</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">プレゼン数</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">推定トークン</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">画像</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">アクティブIP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usageMonitor.map((u) => {
                    const suspicious = u.active_session_count >= 3 || u.presentations_this_month >= 80;
                    return (
                      <tr key={u.id} className={suspicious ? "bg-amber-50" : ""}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{u.full_name || u.email}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PLAN_BADGE[u.plan] || "bg-slate-100 text-slate-600"}`}>
                            {PLAN_LABELS[u.plan] || u.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {u.presentations_this_month}
                          {u.presentations_this_month >= 80 && (
                            <span className="ml-1 text-amber-500 text-xs">⚠️</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs">
                          {u.tokens_estimated_this_month > 0
                            ? u.tokens_estimated_this_month >= 1_000_000
                              ? `${(u.tokens_estimated_this_month / 1_000_000).toFixed(1)}M`
                              : u.tokens_estimated_this_month >= 1_000
                              ? `${(u.tokens_estimated_this_month / 1_000).toFixed(0)}K`
                              : u.tokens_estimated_this_month
                            : "—"
                          }
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {u.images_this_month || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono ${u.active_session_count >= 3 ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                            {u.active_session_count}
                            {u.active_session_count >= 3 && <span className="ml-1">🚨</span>}
                          </span>
                          {u.active_ips.length > 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{u.active_ips.join(", ")}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
                ⚠️ = Proのソフト上限（月100件）に近づいています · 🚨 = 3つ以上の同時IP（アカウント共有の可能性）
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
              「使用データを読み込む」をクリックして今月のアクティビティ上位ユーザーを表示します。
            </div>
          )}
        </div>

        {/* ── AI Model Configuration ───────────────────────────────────────── */}
        <div>
          <div className="mb-4">
            <h2 className="font-semibold text-slate-800 text-lg">AIモデル設定</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              各プランティアが使用するAIモデルを設定します。キーはデータベースで暗号化されており、ユーザーが見たり入力したりすることはありません。
            </p>
          </div>

          {dbOffline && (
            <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <span className="text-amber-500 mt-0.5 text-base">⚠️</span>
              <div>
                <p className="font-semibold">データベースオフライン — 以下の設定はデフォルトのみです。</p>
                <p className="text-xs mt-0.5 text-amber-700">
                  <code className="bg-amber-100 px-1 rounded">DATABASE_URL</code> を <code className="bg-amber-100 px-1 rounded">.env</code> で修正してFastAPIを再起動してください。DBが接続されるまでここで入力したキーは保存されません。
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {aiConfigs.map((cfg) => (
              <PlanAIConfigCard key={cfg.plan} config={cfg} catalog={providerCatalog} onSave={handleSaveAIConfig} />
            ))}
          </div>
        </div>

        {/* ── Plan Pricing & Features ──────────────────────────────────────── */}
        <div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-semibold text-slate-800 text-lg">プラン料金と機能</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                請求ページに表示される価格を設定し、Stripe価格IDを入力してチェックアウトを有効にします。
              </p>
            </div>
            <button
              onClick={handleSavePlanPricing}
              disabled={pricingSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                pricingSaved
                  ? "bg-green-600 text-white"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              } disabled:opacity-50`}
            >
              <Save className="h-4 w-4" />
              {pricingSaving ? "保存中…" : pricingSaved ? "保存済み！" : "料金を保存"}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(["free", "pro", "team"] as const).map((planKey) => (
              <PlanPricingCard
                key={planKey}
                planKey={planKey}
                entry={planPricing[planKey]}
                onChange={(updated) => setPlanPricing((prev) => ({ ...prev, [planKey]: updated }))}
              />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            💡 Stripe価格IDを入力した後、{" "}
            <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="underline text-indigo-500">
              Stripeダッシュボード
            </a>{" "}
            の「商品 → 価格」からIDをコピーしてください。
          </p>
        </div>

        {/* ── Trial Package (Spark) Settings ───────────────────────────────── */}
        <div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-semibold text-slate-800 text-lg">試用パッケージ設定</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                一回払いの試用を設定します（デフォルト：<strong>Spark</strong> — $9.90で7日間のProアクセス）。
              </p>
            </div>
            <button
              onClick={handleSaveTrialConfig}
              disabled={trialSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                trialSaved
                  ? "bg-green-600 text-white"
                  : "bg-amber-500 hover:bg-amber-400 text-white"
              } disabled:opacity-50`}
            >
              <Save className="h-4 w-4" />
              {trialSaving ? "保存中…" : trialSaved ? "保存済み！" : "試用設定を保存"}
            </button>
          </div>
          <div className="bg-white border-2 border-amber-200 rounded-xl p-5 space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700">
                一回払い試用パッケージ
              </span>
              <span className="text-xs text-slate-400 ml-auto">サブスクリプションなし — 自動終了</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">パッケージ名</label>
                <input
                  type="text"
                  value={trialConfig.name}
                  onChange={(e) => setTrialConfig((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Spark"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">期間（日）</label>
                <input
                  type="number"
                  min={1}
                  value={trialConfig.days}
                  onChange={(e) => setTrialConfig((p) => ({ ...p, days: parseInt(e.target.value) || 7 }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">一回払い価格（USD）</label>
                <div className="flex">
                  <span className="px-2.5 py-2 text-sm bg-slate-50 border border-r-0 border-slate-300 rounded-l-lg text-slate-500">$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={trialConfig.price}
                    onChange={(e) => setTrialConfig((p) => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                    className="flex-1 border border-slate-300 rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">通貨</label>
                <input
                  type="text"
                  value={trialConfig.currency}
                  onChange={(e) => setTrialConfig((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                  placeholder="USD"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                  Stripe価格ID <span className="text-slate-400">（一回払い商品 — 先にStripeダッシュボードで作成してください）</span>
              </label>
              <input
                type="text"
                placeholder="price_1ABC… (set to type=one_time in Stripe)"
                value={trialConfig.stripe_price_id}
                onChange={(e) => setTrialConfig((p) => ({ ...p, stripe_price_id: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {!trialConfig.stripe_price_id && (
                <p className="text-[10px] text-amber-600 mt-1">
                  ⚠️ Stripe価格IDが設定されていません — 設定するまで試用購入ボタンはユーザーに表示されません。
                </p>
              )}
            </div>

            <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">機能（1行につき1項目）</label>
        <textarea
          rows={5}
          value={trialConfig.features.join("\n")}
          onChange={(e) => setTrialConfig((p) => ({ ...p, features: e.target.value.split("\n") }))}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <p className="text-[10px] text-slate-400 mt-0.5">請求ページの試用カードに表示されます</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              <strong>セットアップ手順：</strong> StripeダッシュボードでProduct（一回払いのPrice、定期ではない）を作成し、<code className="font-mono">price_1...</code> IDをコピーしてください。試用は設定した日数が経過すると自動的に終了します — ユーザーの操作は不要です。
            </div>
          </div>
        </div>

        {/* ── Payment Settings ─────────────────────────────────────────────── */}
        <div>
          <div className="mb-4">
            <h2 className="font-semibold text-slate-800 text-lg">支払い設定</h2>
              <p className="text-sm text-slate-500 mt-0.5">
              Stripe連携を設定します。キーはデータベースで暗号化されており、ユーザーに公開されることはありません。
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            {/* Mode toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Stripeモード</label>
              <div className="flex gap-3">
                {(["test", "live"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setStripeMode(m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                      stripeMode === m
                        ? m === "live" ? "bg-green-600 text-white border-green-600" : "bg-amber-500 text-white border-amber-500"
                        : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    {m === "test" ? "🧪 テストモード" : "🚀 ライブモード"}
                  </button>
                ))}
              </div>
              {stripeMode === "live" && (
                <p className="text-xs text-amber-600 mt-1.5 font-medium">⚠️ ライブモード — 実際の支払いが発生します。ライブ用のStripeキーを使用していることを確認してください。</p>
              )}
            </div>

            <div className="border-t border-slate-100" />

            {/* Publishable key */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                公開鍵
                <span className="text-xs font-normal text-slate-400 ml-2">（公開しても安全 — フロントエンドで使用）</span>
              </label>
              <input
                type="text"
                value={stripePublishableKey}
                onChange={(e) => setStripePublishableKey(e.target.value)}
                placeholder={stripeMode === "live" ? "pk_live_…" : "pk_test_…"}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Secret key */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                シークレットキー
                {stripeConfig?.secret_key_set && (
                  <span className="ml-2 text-xs font-normal text-green-600">✓ 設定済み — 変更しない場合は空白のままにしてください</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showStripeSecret ? "text" : "password"}
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  placeholder={stripeConfig?.secret_key_set ? "••••••••••••••••• (unchanged)" : stripeMode === "live" ? "sk_live_…" : "sk_test_…"}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowStripeSecret((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showStripeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Webhook secret */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Webhookシークレット
                {stripeConfig?.webhook_secret_set && (
                  <span className="ml-2 text-xs font-normal text-green-600">✓ 設定済み — 変更しない場合は空白のままにしてください</span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showStripeWebhook ? "text" : "password"}
                  value={stripeWebhookSecret}
                  onChange={(e) => setStripeWebhookSecret(e.target.value)}
                  placeholder={stripeConfig?.webhook_secret_set ? "••••••••••••••••• (unchanged)" : "whsec_…"}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowStripeWebhook((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showStripeWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                こちらで確認できます：{" "}
                <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noreferrer" className="text-indigo-500 underline">
                  StripeのWebhookダッシュボード
                </a>
                。登録するWebhook URL：{" "}
                <code className="bg-slate-100 px-1 rounded text-xs">{typeof window !== "undefined" ? window.location.origin : "https://app.yourdomain.com"}/api/v1/webhooks/stripe</code>
              </p>
            </div>

            <div className="border-t border-slate-100 pt-2 flex items-center gap-3">
              <button
                onClick={handleSaveStripeConfig}
                disabled={stripeSaving}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition ${
                  stripeSaved ? "bg-green-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                } disabled:opacity-50`}
              >
                <Save className="h-4 w-4" />
                {stripeSaving ? "保存中…" : stripeSaved ? "保存済み！" : "支払い設定を保存"}
              </button>
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-indigo-500 hover:underline"
              >
                Stripe APIキーを取得 →
              </a>
            </div>
          </div>
        </div>

        {/* ── Email Settings (Mailgun) ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
              <span className="text-rose-500 text-base">✉</span>
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-lg">メール設定</h2>
              <p className="text-xs text-slate-500">Mailgunを設定してユーザーにトランザクションメールを送信します。</p>
            </div>
          </div>

          {mailgunConfig && (
            <div className={`mb-4 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
              mailgunConfig.api_key_set && mailgunConfig.domain
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}>
              <span>{mailgunConfig.api_key_set && mailgunConfig.domain ? "✓ Mailgunが設定されています" : "⚠ Mailgunが設定されていません — メールは送信されません"}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Mailgunドメイン</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="mg.unslid.com"
                  value={mailgunDomain}
                  onChange={(e) => setMailgunDomain(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">送信元メールアドレス</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="noreply@unslid.com"
                  value={mailgunFromEmail}
                  onChange={(e) => setMailgunFromEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">送信元名前</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Unslid"
                  value={mailgunFromName}
                  onChange={(e) => setMailgunFromName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">リージョン</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                  value={mailgunRegion}
                  onChange={(e) => setMailgunRegion(e.target.value as "us" | "eu")}
                >
                  <option value="us">US (api.mailgun.net)</option>
                  <option value="eu">EU (api.eu.mailgun.net)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                APIキー {mailgunConfig?.api_key_set && <span className="text-green-600 ml-1">（設定済み）</span>}
              </label>
              <div className="relative">
                <input
                  type={showMailgunKey ? "text" : "password"}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder={mailgunConfig?.api_key_set ? "変更しない場合は空白のままにしてください" : "key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
                  value={mailgunApiKey}
                  onChange={(e) => setMailgunApiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowMailgunKey(!showMailgunKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showMailgunKey ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            {mailgunTestResult && (
              <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
                mailgunTestResult === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                {mailgunTestResult === "success"
                  ? "✓ テストメールを送信しました — メールボックスをご確認ください"
                  : "✗ テストに失敗しました — 認証情報とドメイン設定を確認してください"}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap pt-1">
              <button
                onClick={handleSaveMailgunConfig}
                disabled={mailgunSaving}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mailgunSaved ? "bg-green-600 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"
                } disabled:opacity-50`}
              >
                <Save className="h-4 w-4" />
                {mailgunSaving ? "保存中…" : mailgunSaved ? "保存済み！" : "メール設定を保存"}
              </button>
              <button
                onClick={handleTestMailgun}
                disabled={mailgunTesting || !mailgunConfig?.api_key_set}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                {mailgunTesting ? "送信中…" : "テストメールを送信"}
              </button>
              <a
                href="https://app.mailgun.com/settings/api_security"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-indigo-500 hover:underline"
              >
                Mailgun APIキーを取得 →
              </a>
            </div>
          </div>
        </div>

        {/* ── Template Management → dedicated page ─────────────────────────── */}
        <button
          onClick={() => router.push("/admin/templates")}
          className="w-full bg-white border border-slate-200 rounded-xl px-6 py-5 flex items-center gap-4 hover:border-indigo-300 hover:shadow-md transition group text-left"
        >
          <div className="p-3 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 transition">
            <LayoutTemplate className="h-6 w-6 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800">テンプレート管理</p>
            <p className="text-xs text-slate-500 mt-0.5">
              組み込みテンプレートのティア・表示設定を管理し、デザイナーPPTXテンプレートをアップロード —
              {" "}{templateTiers.length}件の組み込み · {pptxTemplates.length}件のデザイナー
            </p>
          </div>
          <span className="text-xs font-medium text-indigo-500 group-hover:text-indigo-700 transition shrink-0">
            開く →
          </span>
        </button>

        {/* Users table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
            <h2 className="font-semibold text-slate-800 flex-1">ユーザー</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsers()}
              placeholder="メールまたは名前で検索..."
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
            />
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">全プラン</option>
              <option value="free">無料</option>
              <option value="pro">Pro</option>
              <option value="team">チーム</option>
            </select>
            <button
              onClick={searchUsers}
              disabled={usersLoading}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition disabled:opacity-50"
            >
              {usersLoading ? "…" : "検索"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ユーザー</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">プラン</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">リージョン</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ストレージ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ステータス</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50 transition ${!u.is_active ? "opacity-50" : ""}`}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800">{u.full_name || "—"}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={u.plan}
                        disabled={changingPlan === u.id}
                        onChange={(e) => handleChangePlan(u.id, e.target.value)}
                        className={`text-xs px-2 py-0.5 rounded-full border-0 font-semibold cursor-pointer ${PLAN_BADGE[u.plan] ?? ""}`}
                      >
                        <option value="free">無料</option>
                        <option value="pro">Pro</option>
                        <option value="team">チーム</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-slate-600 text-xs uppercase">{u.storage_region}</td>
                    <td className="px-4 py-4 text-slate-500 text-xs">{formatBytes(u.storage_used_bytes)}</td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {u.is_active ? "アクティブ" : "非アクティブ"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {u.id !== currentUser?.id && (
                        u.is_active ? (
                          <button
                            onClick={() => handleDeactivate(u.id)}
                            className="text-xs text-red-500 hover:text-red-700 transition"
                          >
                            無効化
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(u.id)}
                            className="text-xs text-indigo-500 hover:text-indigo-700 transition"
                          >
                            有効化
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">ユーザーが見つかりません。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-3xl font-bold text-slate-900 mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
