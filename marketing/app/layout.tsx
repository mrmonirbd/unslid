import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { Suspense } from "react";

// next/font/google downloads Inter at build time and self-hosts it.
// No request is made to Google at runtime — GDPR-safe.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Unslid";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.unslid.com";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unslid.com";
const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

export const metadata: Metadata = {
  title: {
    default: `${appName} — AI-Powered Presentations`,
    template: `%s | ${appName}`,
  },
  description:
    "Create professional AI-powered presentations in minutes. From a URL, PDF, or idea — outline, slides, images, and layout generated automatically. Export to PPTX or PDF.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: appName,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    site: "@unslid",
    creator: "@unslid",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
      <body className="min-h-screen flex flex-col">
        {/* GA only loads after the user grants analytics consent via CookieBanner */}
        {gaId && (
          <Suspense>
            <GoogleAnalytics measurementId={gaId} />
          </Suspense>
        )}

        <Header appUrl={appUrl} appName={appName} />
        <main className="flex-1">{children}</main>
        <Footer appName={appName} appUrl={appUrl} />

        {/* GDPR cookie consent banner — shown on first visit */}
        <CookieBanner />
      </body>
    </html>
  );
}
