"use client";

import React from "react";
import {
  Bell,
  FolderOpen,
  HelpCircle,
  Home,
  LayoutPanelLeft,
  LogOut,
  Palette,
  Plus,
  Shield,
  Star,
  User,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useUser } from "@/app/hooks/useUser";

export const defaultNavItems = [
  { key: "dashboard" as const, label: "Dashboard" },
  { key: "templates" as const, label: "Templates" },
  { key: "theme" as const, label: "Themes" },
];

interface RailLinkProps {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  highlight?: boolean;
}

const RailLink = ({ href, label, icon: Icon, active, highlight }: RailLinkProps) => (
  <Link
    href={href}
    prefetch={false}
    className={`group flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition ${
      active
        ? "text-violet-700"
        : highlight
          ? "text-violet-600 hover:text-violet-700"
          : "text-slate-600 hover:text-violet-700"
    }`}
    title={label}
  >
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
        active
          ? "bg-violet-100 text-violet-700"
          : highlight
            ? "bg-violet-600 text-white shadow-sm shadow-violet-200"
            : "text-slate-600 group-hover:bg-violet-50 group-hover:text-violet-700"
      }`}
    >
      <Icon className="h-5 w-5" />
    </span>
    <span className="max-w-[58px] truncate leading-tight">{label}</span>
  </Link>
);

const DashboardSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useUser();

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const mainNav = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/templates", label: "Templates", icon: LayoutPanelLeft },
    { href: "/theme", label: "Themes", icon: Palette },
    { href: "/settings/account", label: "Account", icon: User },
  ];

  return (
    <aside
      className="sticky top-0 z-40 flex h-screen w-[72px] shrink-0 flex-col items-center border-r border-violet-100 bg-[#fbf9ff] py-3"
      aria-label="Dashboard sidebar"
    >
      <button
        onClick={() => router.push("/dashboard")}
        className="mb-5 flex h-9 w-9 items-center justify-center rounded-xl text-violet-700 transition hover:bg-violet-50"
        aria-label="Go to dashboard"
      >
        <LayoutPanelLeft className="h-5 w-5" />
      </button>

      <nav className="flex w-full flex-col items-center gap-1 px-2" aria-label="Main navigation">
        <RailLink href="/upload" label="Create" icon={Plus} active={pathname === "/upload"} highlight />
        {mainNav.map(({ href, label, icon }) => (
          <RailLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={pathname === href || pathname.startsWith(href + "/")}
          />
        ))}
        {user?.is_admin && (
          <RailLink href="/admin" label="Admin" icon={Shield} active={pathname === "/admin" || pathname.startsWith("/admin/")} />
        )}
      </nav>

      <div className="mt-auto flex w-full flex-col items-center gap-1 px-2">
        <RailLink href="/settings/team" label="Projects" icon={FolderOpen} active={pathname === "/settings/team"} />
        <RailLink href="/settings/analytics" label="More" icon={Star} active={pathname === "/settings/analytics"} />
        <a
          href="mailto:support@yourcompany.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold text-slate-600 transition hover:text-violet-700"
          title="Help"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl group-hover:bg-violet-50">
            <HelpCircle className="h-5 w-5" />
          </span>
        </a>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-violet-50 hover:text-violet-700"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        <button
          onClick={signOut}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-50 hover:text-red-500"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
        <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-amber-300 text-xs font-bold text-slate-900 ring-2 ring-white">
          {loading ? "..." : initials}
        </div>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
