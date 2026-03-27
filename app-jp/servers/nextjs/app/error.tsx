"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-6">
      <div className="max-w-lg mx-auto bg-white shadow-md rounded-xl p-8 space-y-5">
        <div className="text-6xl">⚡</div>
        <h1 className="text-2xl font-bold text-gray-800">エラーが発生しました</h1>
        <p className="text-gray-500 text-sm">
          予期しないエラーが発生しました。チームに通知済みです。
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono">エラーID: {error.digest}</p>
        )}
        <div className="flex justify-center gap-3">
          <Button
            onClick={reset}
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            再試行
          </Button>
          <Link href="/dashboard">
            <Button variant="outline">ダッシュボードへ</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
