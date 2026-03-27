import Link from "next/link";
import Image from "next/image";
import { Twitter, Github, Linkedin, Mail } from "lucide-react";

interface FooterProps {
  appName: string;
  appUrl: string;
}

const footerLinks = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Blog", href: "/blog" },
    { label: "Changelog", href: "/blog" },
  ],
  Plans: [
    { label: "Free plan", href: "/pricing" },
    { label: "Pro plan", href: "/pricing" },
    { label: "Team plan", href: "/pricing" },
    { label: "Spark Trial — $9.90", href: "/pricing" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/privacy#cookies" },
    { label: "GDPR", href: "/privacy#geo-storage" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "mailto:hello@unslid.com" },
    { label: "Support", href: "mailto:support@unslid.com" },
    { label: "Careers", href: "/careers" },
  ],
};

export default function Footer({ appName, appUrl }: FooterProps) {
  return (
    <footer>
      {/* ── Pre-footer CTA strip ──────────────────────────────────────── */}
      <div className="bg-gray-950 border-t border-gray-800">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="text-2xl font-extrabold text-white mb-2">
              Start creating with AI today
            </h3>
            <p className="text-gray-400 text-sm max-w-md">
              Free plan available. No credit card required. Upgrade anytime.
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a
              href={`${appUrl}/login`}
              className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
            >
              Start for free
            </a>
            <Link
              href="/pricing"
              className="rounded-xl border border-gray-700 px-6 py-3 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main footer ──────────────────────────────────────────────── */}
      <div className="bg-gray-950 border-t border-gray-800/60">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-6 lg:gap-12">
            {/* Brand column */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2.5 w-fit mb-5">
                <Image src="/icon.svg" width={32} height={32} alt={`${appName} logo`} />
                <span className="font-extrabold text-base text-white">{appName}</span>
              </Link>
              <p className="text-sm text-gray-400 leading-6 max-w-xs">
                AI-powered presentation builder for professionals and teams. From idea to deck in minutes.
              </p>

              <div className="mt-6 flex items-center gap-3">
                {[
                  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
                  { icon: Github, href: "https://github.com", label: "GitHub" },
                  { icon: Linkedin, href: "https://linkedin.com", label: "LinkedIn" },
                  { icon: Mail, href: "mailto:hello@unslid.com", label: "Email" },
                ].map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    className="w-8 h-8 rounded-lg border border-gray-700 flex items-center justify-center text-gray-500 hover:text-white hover:border-gray-500 transition-colors"
                    aria-label={label}
                    target={href.startsWith("http") ? "_blank" : undefined}
                    rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">
                  {category}
                </h3>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} {appName}. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Terms
              </Link>
              <a
                href={`${appUrl}/login`}
                className="text-xs font-medium text-brand-500 hover:text-brand-400 transition-colors"
              >
                Go to app &rarr;
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
