"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const COOKIE_KEY = "cookie_consent";
const LEGAL_DOMAIN = process.env.NEXT_PUBLIC_LEGAL_DOMAIN ?? "https://yourcompany.com";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
    // Allow Mixpanel to initialise from this point
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cookie_consent_accepted"));
    }
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-white border-t border-slate-200 shadow-2xl"
    >
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-slate-600 flex-1">
          We use cookies and analytics to improve your experience. By continuing, you agree to our{" "}
          <Link
            href={`${LEGAL_DOMAIN}/cookies`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-indigo-600 hover:text-indigo-800"
          >
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** Returns true if the user has accepted cookies (safe on server — returns false). */
export function hasCookieConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COOKIE_KEY) === "accepted";
}
