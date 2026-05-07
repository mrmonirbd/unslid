"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/auth/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authClient = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-violet-100 bg-white/95 p-8 shadow-[0_18px_50px_rgba(124,58,237,0.12)] backdrop-blur text-center">
        <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-950 mb-2">Check your email</h2>
        <p className="text-slate-600 text-sm">
          We&apos;ve sent a password reset link to <span className="text-slate-950 font-medium">{email}</span>.
        </p>
        <Link href="/login" className="inline-block mt-6 text-violet-700 hover:text-violet-600 text-sm font-medium transition">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-white/95 p-8 shadow-[0_18px_50px_rgba(124,58,237,0.12)] backdrop-blur">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Reset password</h1>
        <p className="text-slate-600 text-sm">Enter your email and we&apos;ll send you a reset link.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-2.5 bg-white border border-violet-200 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-300 transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="text-center text-slate-600 text-sm mt-6">
        Remember your password?{" "}
        <Link href="/login" className="text-violet-700 hover:text-violet-600 font-medium transition">Sign in</Link>
      </p>
    </div>
  );
}
