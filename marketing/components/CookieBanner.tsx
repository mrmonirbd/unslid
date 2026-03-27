"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

const CONSENT_KEY = "unslid_cookie_consent_v1";

export type CookieConsent = {
  analytics: boolean;
  timestamp: string;
};

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

function saveConsent(analytics: boolean): CookieConsent {
  const consent: CookieConsent = {
    analytics,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  window.dispatchEvent(
    new CustomEvent("unslid:consent", { detail: consent })
  );
  return consent;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = getStoredConsent();
    if (!consent) {
      // Small delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    saveConsent(true);
    setVisible(false);
  };

  const essentialOnly = () => {
    saveConsent(false);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="true"
      className="fixed bottom-0 inset-x-0 z-[100] p-4 md:p-6"
    >
      <div className="mx-auto max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Main row */}
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mt-0.5">
            <Cookie className="w-4.5 h-4.5 text-amber-500 w-[18px] h-[18px]" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 mb-1">
              We use cookies
            </p>
            <p className="text-xs text-gray-500 leading-5">
              We use essential cookies to keep the site working. With your
              consent, we also use Google Analytics to understand how visitors
              use Unslid — helping us improve the product. No advertising or
              third-party tracking.{" "}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="underline hover:text-gray-700 transition-colors"
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>{" "}
              &middot;{" "}
              <Link
                href="/privacy#cookies"
                className="underline hover:text-gray-700 transition-colors"
              >
                Privacy Policy
              </Link>
            </p>
          </div>

          <button
            onClick={essentialOnly}
            aria-label="Dismiss — essential only"
            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Details panel */}
        {showDetails && (
          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                name: "Essential cookies",
                desc: "Required for the site to function. Cannot be disabled.",
                required: true,
              },
              {
                name: "Analytics cookies",
                desc: "Google Analytics 4 — helps us understand page views and user journeys. Anonymous & aggregated.",
                required: false,
              },
            ].map((c) => (
              <div
                key={c.name}
                className="bg-white rounded-xl border border-gray-100 p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-900">
                    {c.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      c.required
                        ? "bg-gray-100 text-gray-500"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {c.required ? "Always on" : "Optional"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-5">{c.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="border-t border-gray-100 px-5 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-end gap-2">
          <button
            onClick={essentialOnly}
            className="w-full sm:w-auto rounded-lg border border-gray-300 px-5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            Essential only
          </button>
          <button
            onClick={accept}
            className="w-full sm:w-auto rounded-lg bg-gray-950 px-5 py-2.5 text-xs font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Accept all cookies
          </button>
        </div>
      </div>
    </div>
  );
}
