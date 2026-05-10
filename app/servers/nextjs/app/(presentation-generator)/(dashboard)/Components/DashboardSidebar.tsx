"use client";

import React from "react";
import {
  Bell,
  HelpCircle,
  Home,
  LayoutPanelLeft,
  LogOut,
  Palette,
  Plus,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useUser } from "@/app/hooks/useUser";

export const defaultNavItems = [
  { key: "dashboard" as const, label: "Dashboard" },
  { key: "templates" as const, label: "My Templates" },
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
  const { user } = useUser();

  const mainNav = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/my-templates", label: "My Templates", icon: LayoutPanelLeft },
    { href: "/theme", label: "Themes", icon: Palette },
  ];

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-40 flex h-20 flex-row items-center border-t border-violet-100 bg-[#fbf9ff]/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur md:sticky md:top-0 md:h-screen md:w-[72px] md:shrink-0 md:flex-col md:border-r md:border-t-0 md:bg-[#fbf9ff] md:py-3 md:shadow-none"
      aria-label="Dashboard sidebar"
    >
      <button
        onClick={() => router.push("/dashboard")}
        className="hidden h-9 w-9 items-center justify-center rounded-xl text-violet-700 transition hover:bg-violet-50 md:mb-5 md:flex"
        aria-label="Go to dashboard"
      >
        {/* <LayoutPanelLeft className="h-5 w-5" /> */}
        <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shadow-[0_12px_30px_rgba(124,58,237,0.22)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            {/* <span className="text-slate-950 font-bold text-sm tracking-tight">Unslid</span> */}
          </div>
    
      </button>
      

      <nav className="flex min-w-0 flex-1 items-center justify-around gap-1 px-1 md:w-full md:flex-none md:flex-col md:justify-start md:px-2" aria-label="Main navigation">
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

      <div className="flex items-center gap-1 px-1 md:mt-auto md:w-full md:flex-col md:px-2">
        <RailLink href="/settings/account" label="Account" icon={User} active={pathname === "/settings/account"} />
        <a
          href="mailto:support@yourcompany.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group hidden w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold text-slate-600 transition hover:text-violet-700 md:flex"
          title="Help"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl group-hover:bg-violet-50">
            <HelpCircle className="h-5 w-5" />
          </span>
        </a>
        <button
          className="hidden h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 md:flex"
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
      </div>
    </aside>
  );
};

export default DashboardSidebar;
