import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import MixpanelInitializer from "./MixpanelInitializer";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { Suspense } from "react";
import Script from "next/script";

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
      <Script id="google-tag-manager" strategy="beforeInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PCN89WT8');`}
      </Script>
      <body
        className={`${inter.variable} ${unbounded.variable} ${syne.variable} antialiased`}
      >
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-PCN89WT8"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
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
