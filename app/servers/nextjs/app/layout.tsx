import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import MixpanelInitializer from "./MixpanelInitializer";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { Suspense } from "react";

const inter = localFont({
  src: [
    {
      path: "./fonts/Inter.ttf",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-inter",
});

const syne = localFont({
  src: "./fonts/Syne-Regular.ttf",
  variable: "--font-syne",
});

const unbounded = localFont({
  src: "./fonts/Unbounded-Regular.ttf",
  variable: "--font-unbounded",
});


export const metadata: Metadata = {
  title: {
    default: "Unslid — AI-Powered Presentations",
    template: "%s | Unslid",
  },
  description:
    "Create professional AI-powered presentations in minutes. From a URL, PDF, or idea — export to PPTX or PDF.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${unbounded.variable} ${syne.variable} antialiased`}
      >
        <Suspense>
          <GoogleAnalytics />
        </Suspense>
        <Providers>
          <MixpanelInitializer>

            {children}

          </MixpanelInitializer>
        </Providers>
        <Toaster position="top-center" />
        <CookieConsent />
      </body>
    </html>
  );
}
