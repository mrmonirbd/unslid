"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/auth/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authClient = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await authClient.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/login?message=password_updated");
  };

  return (
    <div className="rounded-2xl border border-violet-100 bg-white/95 p-8 shadow-[0_18px_50px_rgba(124,58,237,0.12)] backdrop-blur">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-950 mb-1">Set new password</h1>
        <p className="text-slate-600 text-sm">Choose a strong password for your account.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Minimum 8 characters"
            minLength={8}
            className="w-full px-4 py-2.5 bg-white border border-violet-200 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-300 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            placeholder="Repeat your password"
            className="w-full px-4 py-2.5 bg-white border border-violet-200 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-100 focus:border-violet-300 transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition"
        >
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>

      <p className="text-center text-slate-600 text-sm mt-6">
        <Link href="/login" className="text-violet-700 hover:text-violet-600 font-medium transition">Back to login</Link>
      </p>
    </div>
  );
}
