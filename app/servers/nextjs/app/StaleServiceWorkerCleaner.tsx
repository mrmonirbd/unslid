"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "unslid_sw_cleanup_reloaded";

export function StaleServiceWorkerCleaner() {
  useEffect(() => {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const shouldClean = process.env.NODE_ENV !== "production" || isLocalhost;

    if (!shouldClean || !("serviceWorker" in navigator)) return;

    const cleanup = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const hadRegistrations = registrations.length > 0;
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      if (hadRegistrations && sessionStorage.getItem(RELOAD_FLAG) !== "1") {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
      }
    };

    cleanup().catch((error) => {
      console.warn("Unable to clear stale service worker cache", error);
    });
  }, []);

  return null;
}
