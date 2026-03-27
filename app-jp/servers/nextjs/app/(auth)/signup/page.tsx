"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/components/GoogleAnalytics";

// Geo region detection and mapping
const REGION_MAP: Record<string, { label: string; bucket: string }> = {
  eu: { label: "欧州連合（ドイツ・フランクフルト）", bucket: "eu" },
  us: { label: "米国（バージニア州）", bucket: "us" },
  "ap-se": { label: "アジア太平洋 — 東南アジア（シンガポール）", bucket: "ap-se" },
  "ap-ne": { label: "アジア太平洋 — 東アジア（東京）", bucket: "ap-ne" },
};

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Capture UTM parameters from URL at render time
  const [utmSource]   = useState(() => searchParams.get("utm_source")   ?? undefined);
  const [utmMedium]   = useState(() => searchParams.get("utm_medium")   ?? undefined);
  const [utmCampaign] = useState(() => searchParams.get("utm_campaign") ?? undefined);

  const [step, setStep] = useState<"details" | "region">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [detectedRegion] = useState<string>("eu"); // Default EU — will be set via API
  const [selectedRegion, setSelectedRegion] = useState<string>("eu");
  const [regionAcknowledged, setRegionAcknowledged] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const LEGAL_DOMAIN = process.env.NEXT_PUBLIC_LEGAL_DOMAIN ?? "https://yourcompany.com";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください。");
      return;
    }
    setError(null);
    setStep("region");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regionAcknowledged) {
      setError("続けるにはデータ保存場所を確認してください。");
      return;
    }
    if (!tosAccepted) {
      setError("続けるには利用規約とプライバシーポリシーに同意してください。");
      return;
    }

    // EU users cannot select non-EU region (GDPR)
    if (detectedRegion === "eu" && selectedRegion !== "eu") {
      setError(
        "EU居住者として、GDPRの規定によりデータはEU内に保存する必要があります。"
      );
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          storage_region: selectedRegion,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    trackEvent("sign_up", { method: "email", utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">メールをご確認ください</h2>
        <p className="text-slate-400 text-sm">
          <span className="text-white font-medium">{email}</span> に確認リンクを送信しました。
          リンクをクリックしてアカウントを有効化してください。
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 text-indigo-400 hover:text-indigo-300 text-sm font-medium transition"
        >
          ログインに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition ${step === "details" ? "bg-indigo-600 text-white" : "bg-green-500 text-white"}`}>
          {step === "region" ? "✓" : "1"}
        </div>
        <div className="flex-1 h-px bg-slate-700" />
        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition ${step === "region" ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"}`}>
          2
        </div>
      </div>

      {step === "details" && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">アカウントを作成</h1>
            <p className="text-slate-400 text-sm">今日からAIプレゼンを始めましょう</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">お名前</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="山田 太郎"
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="8文字以上"
                minLength={8}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition"
            >
              次へ
            </button>
          </form>
        </>
      )}

      {step === "region" && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">データ保存場所</h1>
            <p className="text-slate-400 text-sm">
              データを安全に保存する場所を選択してください。GDPRコンプライアンスのために必要です。
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              {Object.entries(REGION_MAP).map(([key, { label }]) => {
                const isEuUserNonEu = detectedRegion === "eu" && key !== "eu";
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      selectedRegion === key
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-700 bg-slate-900/30 hover:border-slate-600"
                    } ${isEuUserNonEu ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="region"
                      value={key}
                      checked={selectedRegion === key}
                      disabled={isEuUserNonEu}
                      onChange={() => setSelectedRegion(key)}
                      className="mt-0.5 accent-indigo-500"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">{label}</div>
                      {key === detectedRegion && (
                        <div className="text-indigo-400 text-xs mt-0.5">お客様の位置情報に基づき検出されました</div>
                      )}
                      {isEuUserNonEu && (
                        <div className="text-amber-400 text-xs mt-0.5">利用不可 — GDPRによりEUのデータはEU内に保存する必要があります</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-300 text-xs leading-relaxed">
                <strong>データの保存先：</strong>{" "}
                {REGION_MAP[selectedRegion]?.label}。この設定はアカウント作成後に変更できません。
                保存場所はいつでもアカウント設定で確認できます。
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={regionAcknowledged}
                onChange={(e) => setRegionAcknowledged(e.target.checked)}
                className="mt-0.5 accent-indigo-500"
              />
              <span className="text-slate-300 text-sm">
                データが{" "}
                <strong className="text-white">{REGION_MAP[selectedRegion]?.label}</strong>{" "}
                に保存されることを理解し、同意します。
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 accent-indigo-500"
              />
              <span className="text-slate-300 text-sm">
                <a
                  href={`${LEGAL_DOMAIN}/terms`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  利用規約
                </a>
                {" "}および{" "}
                <a
                  href={`${LEGAL_DOMAIN}/privacy`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  プライバシーポリシー
                </a>
                に同意します。
              </span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition"
              >
                戻る
              </button>
              <button
                type="submit"
                disabled={loading || !regionAcknowledged || !tosAccepted}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
              >
                {loading ? "作成中..." : "アカウントを作成"}
              </button>
            </div>
          </form>
        </>
      )}

      <p className="text-center text-slate-400 text-sm mt-6">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition">
          サインイン
        </Link>
      </p>
    </div>
  );
}
