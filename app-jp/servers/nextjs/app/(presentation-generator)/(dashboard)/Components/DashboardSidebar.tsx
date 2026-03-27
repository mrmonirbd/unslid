"use client";

import React from "react";
import {
  LayoutDashboard,
  Star,
  Palette,
  LogOut,
  User,
  CreditCard,
  Users,
  Shield,
  Cpu,
  BarChart2,
  Sparkles,
  ChevronRight,
  LifeBuoy,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, signOut } from "@/app/hooks/useUser";

export const defaultNavItems = [
  { key: "dashboard" as const, label: "ダッシュボード" },
  { key: "templates" as const, label: "テンプレート" },
  { key: "theme" as const, label: "テーマ" },
];

const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  free:  { label: "無料",  className: "bg-slate-700 text-slate-300" },
  pro:   { label: "Pro",   className: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" },
  team:  { label: "チーム",  className: "bg-violet-500/20 text-violet-300 border border-violet-500/30" },
  admin: { label: "管理者", className: "bg-amber-500/20 text-amber-300 border border-amber-500/30" },
};

interface NavLinkProps {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  variant?: "default" | "danger" | "highlight";
}

const NavLink = ({ href, label, icon: Icon, active, variant = "default" }: NavLinkProps) => {
  if (variant === "danger") {
    return (
      <Link
        href={href}
        prefetch={false}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          active
            ? "bg-red-500/15 text-red-400"
            : "text-slate-400 hover:text-red-400 hover:bg-red-500/10"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </Link>
    );
  }

  if (variant === "highlight") {
    return (
      <Link
        href={href}
        prefetch={false}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          active
            ? "bg-amber-500/15 text-amber-300"
            : "text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/30"
          : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
};

const DashboardSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useUser();

  const plan = user?.plan ?? "free";
  const badge = user?.is_admin ? PLAN_BADGE.admin : (PLAN_BADGE[plan] ?? PLAN_BADGE.free);
  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const mainNav = [
    { href: "/dashboard",  label: "ダッシュボード", icon: LayoutDashboard },
    { href: "/templates",  label: "テンプレート",  icon: Star },
    { href: "/theme",      label: "テーマ",     icon: Palette },
  ];

  const settingsNav = [
    { href: "/settings/account",   label: "アカウント",   icon: User },
    { href: "/settings/billing",   label: "請求",   icon: CreditCard },
    { href: "/settings/team",      label: "チーム",      icon: Users },
    { href: "/settings/analytics", label: "分析", icon: BarChart2 },
    ...(plan === "pro" || plan === "team"
      ? [{ href: "/settings/ai-preferences", label: "AIモデル", icon: Cpu }]
      : []),
  ];

  return (
    <aside
      className="sticky top-0 h-screen w-[240px] shrink-0 flex flex-col bg-[#0F172A] border-r border-white/5"
      aria-label="ダッシュボードサイドバー"
    >
      {/* Logo */}
      <div
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-3 px-5 py-[18px] border-b border-white/5 cursor-pointer"
      >
        <div className="bg-indigo-600 rounded-lg p-1.5 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>
        <span className="font-bold text-slate-100 text-sm tracking-tight">Unslid</span>
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6">

        {/* Main navigation */}
        <nav aria-label="メインナビゲーション">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">
            ワークスペース
          </p>
          <div className="space-y-0.5">
            {mainNav.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname === href}
              />
            ))}
          </div>
        </nav>

        {/* Settings navigation */}
        <nav aria-label="設定ナビゲーション">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">
            アカウント
          </p>
          <div className="space-y-0.5">
            {settingsNav.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname === href || pathname.startsWith(href + "/")}
              />
            ))}
          </div>
        </nav>

        {/* Admin link */}
        {user?.is_admin && (
          <nav aria-label="管理者ナビゲーション">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-2">
              管理者
            </p>
            <div className="space-y-0.5">
              <NavLink
                href="/admin"
                label="管理者パネル"
                icon={Shield}
                active={pathname === "/admin" || pathname.startsWith("/admin/")}
                variant="highlight"
              />
            </div>
          </nav>
        )}
      </div>

      {/* Bottom section */}
      <div className="border-t border-white/5 px-3 py-3 space-y-2">
        {/* Upgrade nudge for free users */}
        {plan === "free" && !user?.is_admin && (
          <Link
            href="/settings/billing"
            prefetch={false}
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-all duration-150 text-white text-xs font-semibold group"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Proにアップグレード</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 border border-white/5">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-indigo-500/30">
            {loading ? "…" : initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-200 truncate leading-tight">
              {user?.full_name || user?.email || "アカウント"}
            </p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold mt-0.5 inline-block ${badge.className}`}>
              {badge.label}
            </span>
          </div>
        </div>

        {/* Help & Support */}
        <a
          href="mailto:support@yourcompany.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all duration-150"
        >
          <LifeBuoy className="h-4 w-4 shrink-0" />
          <span>ヘルプ＆サポート</span>
        </a>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
