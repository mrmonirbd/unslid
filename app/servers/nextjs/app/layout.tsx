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
import { StaleServiceWorkerCleaner } from "./StaleServiceWorkerCleaner";

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

const iframeAuthBridgeScript = `
(function () {
  var tokenKey = "unslid_access_token";
  var cookieName = "unslid_access_token";

  function readCookie() {
    try {
      var match = document.cookie.match(new RegExp("(?:^|; )" + cookieName + "=([^;]*)"));
      return match ? decodeURIComponent(match[1]) : "";
    } catch (error) {
      return "";
    }
  }

  function getStoredToken() {
    try {
      return window.__UNSLID_ACCESS_TOKEN || localStorage.getItem(tokenKey) || readCookie();
    } catch (error) {
      return window.__UNSLID_ACCESS_TOKEN || readCookie();
    }
  }

  function rememberToken(token) {
    if (!token) return;
    window.__UNSLID_ACCESS_TOKEN = token;
    try {
      localStorage.setItem(tokenKey, token);
    } catch (error) {}
    try {
      document.cookie = cookieName + "=" + encodeURIComponent(token) + "; path=/; max-age=604800; SameSite=Lax";
    } catch (error) {}
  }

  function sameOriginApiUrl(value) {
    if (!value) return null;
    try {
      var raw = typeof value === "string" ? value : value.url;
      if (!raw) return null;
      var url = new URL(raw, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname.indexOf("/api/") !== 0) return null;
      return url;
    } catch (error) {
      return null;
    }
  }

  try {
    var currentUrl = new URL(window.location.href);
    var iframeToken = currentUrl.searchParams.get("iframeToken");
    if (iframeToken) {
      rememberToken(iframeToken);
      currentUrl.searchParams.delete("iframeToken");
      window.history.replaceState(null, "", currentUrl.pathname + currentUrl.search + currentUrl.hash);
    } else {
      rememberToken(getStoredToken());
    }
  } catch (error) {}

  if (window.__UNSLID_IFRAME_AUTH_BRIDGE__) return;
  window.__UNSLID_IFRAME_AUTH_BRIDGE__ = true;

  var originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = function (input, init) {
      var token = getStoredToken();
      var url = sameOriginApiUrl(input);
      if (!token || !url) {
        return originalFetch.apply(this, arguments);
      }

      var nextInit = init ? Object.assign({}, init) : {};
      var requestHeaders = typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined;
      var headers = new Headers(nextInit.headers || requestHeaders || undefined);
      if (!headers.has("authorization")) {
        headers.set("authorization", "Bearer " + token);
      }
      nextInit.headers = headers;
      return originalFetch.call(this, input, nextInit);
    };
  }

  var OriginalEventSource = window.EventSource;
  if (typeof OriginalEventSource === "function") {
    window.EventSource = function (url, config) {
      var token = getStoredToken();
      var parsed = sameOriginApiUrl(url);
      if (token && parsed && !parsed.searchParams.has("token")) {
        parsed.searchParams.set("token", token);
        url = parsed.pathname + parsed.search + parsed.hash;
      }
      return new OriginalEventSource(url, config);
    };
    window.EventSource.prototype = OriginalEventSource.prototype;
  }
})();
`;

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
        <Script id="iframe-auth-bridge" strategy="beforeInteractive">
          {iframeAuthBridgeScript}
        </Script>
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PCN89WT8');`}
        </Script>
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
        <StaleServiceWorkerCleaner />
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
