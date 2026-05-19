"use client";

import Link from "next/link";

const footerLinks = [
  { label: "About", href: "/about" },
  { label: "Contact us", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Subscription policy", href: "/subscription-policy" },
  { label: "Terms", href: "/terms" },
  { label: "Refund policy", href: "/refund-policy" },
];

const CommonFooter = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-slate-200 px-4 py-6 font-syne text-sm text-slate-500 sm:px-6 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium text-slate-400">© {year} Unslid. All rights reserved.</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer links">
          {footerLinks.map((link) => {
            const isExternal = link.href.startsWith("http");
            if (isExternal) {
              return (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-slate-500 transition hover:text-violet-700"
                >
                  {link.label}
                </a>
              );
            }

            return (
              <Link
                key={link.label}
                href={link.href}
                className="font-semibold text-slate-500 transition hover:text-violet-700"
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
};

export default CommonFooter;
