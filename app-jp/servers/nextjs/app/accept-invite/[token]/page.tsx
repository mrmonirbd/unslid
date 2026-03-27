"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "accepting" | "done" | "error" | "needs-login">("loading");
  const [error, setError] = useState<string | null>(null);
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setStatus("needs-login");
      } else {
        setStatus("accepting");
        api
          .post<{ ok: boolean; org_slug: string | null }>(`/api/v1/org/accept-invite/${token}`)
          .then((res) => {
            setOrgSlug(res.org_slug);
            setStatus("done");
          })
          .catch((e) => {
            setError(e.message);
            setStatus("error");
          });
      }
    });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Unslid</span>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl text-center">
          {status === "loading" && (
            <p className="text-slate-400 text-sm">招待を確認中…</p>
          )}

          {status === "accepting" && (
            <>
              <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white font-medium">チームに参加中…</p>
            </>
          )}

          {status === "done" && (
            <>
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">参加完了！</h2>
              <p className="text-slate-400 text-sm mb-6">
                チームへの参加が完了しました。
              </p>
              <button
                onClick={() => router.push(orgSlug ? `/settings/team` : "/dashboard")}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition"
              >
                ダッシュボードへ
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">招待エラー</h2>
              <p className="text-red-400 text-sm mb-6">{error}</p>
              <Link
                href="/dashboard"
                className="inline-block text-indigo-400 hover:text-indigo-300 text-sm font-medium transition"
              >
                ダッシュボードへ
              </Link>
            </>
          )}

          {status === "needs-login" && (
            <>
              <div className="w-14 h-14 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">サインインして招待を受け入れる</h2>
              <p className="text-slate-400 text-sm mb-6">
                この招待を受け入れるにはサインインが必要です。
              </p>
              <Link
                href={`/login?redirectTo=/accept-invite/${token}`}
                className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition text-center"
              >
                サインイン
              </Link>
              <p className="text-slate-400 text-sm mt-4">
                アカウントをお持ちでない場合は{" "}
                <Link href={`/signup?redirectTo=/accept-invite/${token}`} className="text-indigo-400 hover:text-indigo-300 font-medium">
                  無料登録
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
