"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const showDetails = process.env.NODE_ENV !== "production";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-6">
      <div className="max-w-lg mx-auto bg-white shadow-md rounded-xl p-8 space-y-5">
        <div className="text-6xl">⚡</div>
        <h1 className="text-2xl font-bold text-gray-800">Something went wrong</h1>
        <p className="text-gray-500 text-sm">
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono">Error ID: {error.digest}</p>
        )}
        {showDetails && error.message && (
          <pre className="max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 text-left text-xs text-slate-100">
            {error.message}
          </pre>
        )}
        <div className="flex justify-center gap-3">
          <Button
            onClick={reset}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Try again
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">Go to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
