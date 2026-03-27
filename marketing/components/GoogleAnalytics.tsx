"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { getStoredConsent, type CookieConsent } from "./CookieBanner";

interface GoogleAnalyticsProps {
  measurementId: string;
}

export default function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    // Check if consent was already given in a previous visit
    const stored = getStoredConsent();
    if (stored?.analytics) {
      setAnalyticsEnabled(true);
    }

    // Listen for live consent changes from the banner
    const handleConsent = (e: Event) => {
      const consent = (e as CustomEvent<CookieConsent>).detail;
      setAnalyticsEnabled(consent.analytics);

      // If user revokes analytics, instruct GA to stop collecting
      if (!consent.analytics && typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("consent", "update", {
          analytics_storage: "denied",
        });
      }
    };

    window.addEventListener("unslid:consent", handleConsent);
    return () => window.removeEventListener("unslid:consent", handleConsent);
  }, []);

  if (!analyticsEnabled || !measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
          });
          gtag('config', '${measurementId}', {
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
