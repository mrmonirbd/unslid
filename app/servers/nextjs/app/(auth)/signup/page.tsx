"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/auth/client";
import { trackEvent } from "@/components/GoogleAnalytics";

// Geo region detection and mapping
const REGION_MAP: Record<string, { label: string; bucket: string }> = {
  eu: { label: "European Union (Frankfurt, Germany)", bucket: "eu" },
  us: { label: "United States (Virginia, USA)", bucket: "us" },
  "ap-se": { label: "Asia Pacific — Southeast (Singapore)", bucket: "ap-se" },
  "ap-ne": { label: "Asia Pacific — Northeast (Tokyo, Japan)", bucket: "ap-ne" },
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
  const authClient = createClient();

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError(null);
    setStep("region");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regionAcknowledged) {
      setError("Please acknowledge the data storage location to continue.");
      return;
    }
    if (!tosAccepted) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    // EU users cannot select non-EU region (GDPR)
    if (detectedRegion === "eu" && selectedRegion !== "eu") {
      setError(
        "As an EU resident, your data must remain in the EU under GDPR regulations."
      );
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await authClient.auth.signUp({
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
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    trackEvent("sign_up", { method: "email", utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign });
    router.push("/login?message=account_created");
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="rounded-2xl border border-violet-100 bg-white/95 p-8 shadow-[0_18px_50px_rgba(124,58,237,0.12)] backdrop-blur">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition ${step === "details" ? "bg-slate-950 text-white" : "bg-emerald-500 text-white"}`}>
          {step === "region" ? "✓" : "1"}
        </div>
        <div className="flex-1 h-px bg-violet-100" />
        <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition ${step === "region" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-500"}`}>
          2
        </div>
      </div>

      {step === "details" && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-950 mb-1">Create account</h1>
            <p className="text-slate-600 text-sm">Start creating AI presentations today</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleDetailsSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full px-4 py-2.5 bg-white border border-violet-200 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-300 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 bg-white border border-violet-200 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-300 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Minimum 8 characters"
                minLength={8}
                className="w-full px-4 py-2.5 bg-white border border-violet-200 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-300 transition"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-semibold rounded-xl transition"
            >
              Continue
            </button>
          </form>
        </>
      )}

      {step === "region" && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-950 mb-1">Data storage location</h1>
            <p className="text-slate-600 text-sm">
              Where your data will be securely stored. This is required for GDPR compliance.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
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
                        ? "border-violet-300 bg-violet-50"
                        : "border-violet-100 bg-white hover:border-violet-200"
                    } ${isEuUserNonEu ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="region"
                      value={key}
                      checked={selectedRegion === key}
                      disabled={isEuUserNonEu}
                      onChange={() => setSelectedRegion(key)}
                      className="mt-0.5 accent-violet-600"
                    />
                    <div>
                      <div className="text-slate-950 text-sm font-medium">{label}</div>
                      {key === detectedRegion && (
                        <div className="text-violet-700 text-xs mt-0.5">Detected based on your location</div>
                      )}
                      {isEuUserNonEu && (
                        <div className="text-amber-400 text-xs mt-0.5">Not available — GDPR requires EU data to stay in EU</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="p-3 bg-cyan-50 border border-cyan-100 rounded-xl">
              <p className="text-cyan-800 text-xs leading-relaxed">
                <strong>Your data will be stored in:</strong>{" "}
                {REGION_MAP[selectedRegion]?.label}. This setting is permanent after account creation.
                You can view your storage region at any time in account settings.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={regionAcknowledged}
                onChange={(e) => setRegionAcknowledged(e.target.checked)}
                className="mt-0.5 accent-violet-600"
              />
              <span className="text-slate-700 text-sm">
                I understand and agree that my data will be stored in{" "}
                <strong className="text-slate-950">{REGION_MAP[selectedRegion]?.label}</strong>.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 accent-violet-600"
              />
              <span className="text-slate-700 text-sm">
                I agree to the{" "}
                <a
                  href={`${LEGAL_DOMAIN}/terms`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-700 hover:text-violet-600 underline"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href={`${LEGAL_DOMAIN}/privacy`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-700 hover:text-violet-600 underline"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="flex-1 py-2.5 bg-white hover:bg-violet-50 text-slate-700 border border-violet-200 font-medium rounded-xl transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !regionAcknowledged || !tosAccepted}
                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </div>
          </form>
        </>
      )}

      <p className="text-center text-slate-600 text-sm mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-violet-700 hover:text-violet-600 font-medium transition">
          Sign in
        </Link>
      </p>
    </div>
  );
}
