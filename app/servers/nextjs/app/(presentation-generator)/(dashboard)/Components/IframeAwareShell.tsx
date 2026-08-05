"use client";

import CommonFooter from "@/components/CommonFooter";
import { Home, LayoutPanelLeft, Palette, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";
import DashboardSidebar from "./DashboardSidebar";

type SidebarPosition = "start" | "end" | "none";
type SearchParamsLike = { get(name: string): string | null };

interface IframeAwareShellProps {
  children: React.ReactNode;
  contentClassName?: string;
  iframeContentClassName?: string;
  normalSidebar?: SidebarPosition;
  showFooter?: boolean;
}

const navItems = [
  { href: "/upload", label: "Create", icon: Plus },
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/my-templates", label: "My Templates", icon: LayoutPanelLeft },
  { href: "/theme", label: "Theme", icon: Palette },
];

export function isIframeMode(searchParams: SearchParamsLike) {
  return searchParams.get("iframe") === "1";
}

function iframeHref(href: string, searchParams: SearchParamsLike) {
  if (!isIframeMode(searchParams)) return href;
  const [path, currentQuery = ""] = href.split("?");
  const params = new URLSearchParams(currentQuery);
  params.set("iframe", "1");
  const siteDomain = searchParams.get("siteDomain");
  if (siteDomain) params.set("siteDomain", siteDomain);
  return `${path}?${params.toString()}`;
}

function IframeTopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <header className="z-50 shrink-0 border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-center gap-1 overflow-x-auto" aria-label="Iframe navigation">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={iframeHref(href, searchParams)}
              prefetch={false}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                active
                  ? "bg-violet-100 text-violet-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

const defaultContentClassName =
  "min-h-0 min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_32%),linear-gradient(180deg,#fbf9ff_0%,#ffffff_48%,#f8fafc_100%)] md:h-screen";

export function IframeAwareShell({
  children,
  contentClassName = defaultContentClassName,
  iframeContentClassName = defaultContentClassName,
  normalSidebar = "end",
  showFooter = true,
}: IframeAwareShellProps) {
  const searchParams = useSearchParams();

  if (isIframeMode(searchParams)) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-[#fbf9ff] text-slate-950">
        <IframeTopNav />
        <main className={iframeContentClassName}>{children}</main>
      </div>
    );
  }

  if (normalSidebar === "start") {
    return (
      <div className="flex h-dvh flex-col-reverse overflow-hidden bg-[#fbf9ff] text-slate-950 md:flex-row">
        <DashboardSidebar />
        <div className={contentClassName}>
          {children}
          {showFooter && <CommonFooter />}
        </div>
      </div>
    );
  }

  if (normalSidebar === "none") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#fbf9ff] text-slate-950 md:flex-row">
      <div className={contentClassName}>
        {children}
        {showFooter && <CommonFooter />}
      </div>
      <DashboardSidebar />
    </div>
  );
}

export function withIframeSearch(
  href: string,
  searchParams: SearchParamsLike
) {
  return iframeHref(href, searchParams);
}
