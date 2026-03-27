import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How we collect, use, and protect your data.",
};

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Unslid";
const lastUpdated = "March 2026";

const sections = [
  {
    id: "data-collected",
    title: "1. Data we collect",
    content: `We collect the following categories of personal data:\n\n• Account data: name, email address, and authentication details (managed via Supabase Auth).\n• Usage data: presentations created, templates used, export events, and session timestamps.\n• Billing data: subscription status and billing history (payment processing handled by Stripe — we do not store full card numbers).\n• Technical data: IP address, browser type, device information, and cookies.\n• Content data: the presentations and files you upload or generate while using the Service.`,
  },
  {
    id: "geo-storage",
    title: "2. Data storage and geo-routing",
    content: `We operate geo-aware data storage to keep your data close to you and compliant with regional law:\n\n• EU users: Files are stored in EU data centres (Wasabi eu-central-1, Frankfurt).\n• US users: Files are stored in US data centres.\n• Other regions: Files are routed to the nearest available region.\n\nYou are notified of your assigned storage region at account creation and can view it in your account settings at any time.`,
  },
  {
    id: "legal-basis",
    title: "3. Legal basis for processing",
    content: `We process your data under the following lawful bases:\n\n• Contract: to provide the service you have signed up for.\n• Legitimate interest: to improve our product, monitor abuse, and prevent fraud.\n• Consent: for marketing emails and analytics cookies.\n• Legal obligation: to comply with applicable financial and data protection laws.`,
  },
  {
    id: "data-sharing",
    title: "4. Data sharing",
    content: `We do not sell your personal data. We share data only with trusted sub-processors necessary to provide the service:\n\n• Supabase — authentication and user management\n• Stripe — billing and payment processing\n• Wasabi — object storage for presentations and exports\n• Resend — transactional email (invites, password reset, billing)\n• Sentry — error monitoring and performance tracking\n\nAll sub-processors are contractually bound to protect your data and may not use it for their own purposes.`,
  },
  {
    id: "your-rights",
    title: "5. Your rights",
    content: `Under GDPR and applicable privacy laws, you have the right to:\n\n• Access the personal data we hold about you.\n• Rectify inaccurate data.\n• Erase your data ("right to be forgotten") — available directly from account settings.\n• Restrict or object to certain processing.\n• Data portability — export your data in a machine-readable format.\n• Withdraw consent at any time for consent-based processing.\n\nTo exercise these rights, visit your account settings or email privacy@unslid.com. We will respond within 30 days.`,
  },
  {
    id: "cookies",
    title: "6. Cookies",
    content: `We use cookies in the following categories:\n\n**Essential cookies** — required for the site to function correctly. These cannot be disabled.\n\n**Analytics cookies (optional, consent required)** — we use Google Analytics 4 (GA4) to understand how visitors use our site. These are only set if you click "Accept all cookies" in the consent banner. GA4 is configured with:\n• anonymize_ip: true — your IP address is anonymised before being sent to Google\n• ad_storage: denied — no advertising data collected\n• allow_google_signals: false — no cross-site tracking\n\nYou can update your cookie preferences at any time by clearing your browser's localStorage or revisiting the site in a private window to trigger the consent banner again.\n\nFor a full inventory of cookies set on this site, see the table below.`,
  },
  {
    id: "retention",
    title: "7. Data retention",
    content: `We retain your personal data for as long as your account is active. Upon account deletion:\n\n• Your presentations and files are deleted immediately.\n• Your personal identifiers (name, email) are anonymised within 30 days.\n• Billing records may be retained for up to 7 years to comply with financial regulations.\n• Anonymised, aggregated usage data may be retained indefinitely for product analytics.`,
  },
  {
    id: "security",
    title: "8. Security",
    content: `We implement industry-standard security measures including:\n\n• Encryption in transit (TLS 1.2+) and at rest.\n• API key and Stripe secret field-level encryption using Fernet.\n• Rate limiting and concurrency controls on all API endpoints.\n• Regular automated database backups.\n• Structured logging and Sentry error monitoring.\n\nDespite these measures, no system is completely secure. If you discover a security issue, please report it to security@unslid.com.`,
  },
  {
    id: "children",
    title: "9. Children's privacy",
    content: `The Service is not directed to children under 16. We do not knowingly collect personal data from children under 16. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.`,
  },
  {
    id: "contact",
    title: "10. Contact & complaints",
    content: `For privacy enquiries, contact our Data Protection contact at:\n\nprivacy@unslid.com\n\nYou also have the right to lodge a complaint with your local data protection authority (e.g. the ICO in the UK, or the relevant supervisory authority in your EU member state).`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="pt-24 bg-white">
      {/* Page header */}
      <div className="border-b border-gray-100 py-14 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
        </div>
      </div>

      {/* Content with sidebar */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Sidebar TOC */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
                Contents
              </p>
              <nav className="space-y-1">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block text-sm text-gray-500 hover:text-brand-600 hover:pl-1 transition-all py-0.5"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
              <div className="mt-4">
                <a
                  href="#cookie-table"
                  className="block text-sm text-gray-500 hover:text-brand-600 hover:pl-1 transition-all py-0.5"
                >
                  Cookie inventory
                </a>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-3">Related</p>
                <Link href="/terms" className="block text-sm text-brand-600 hover:underline">
                  Terms of Service &rarr;
                </Link>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 max-w-2xl">
            <p className="text-gray-600 leading-8 mb-10 text-base">
              {appName} (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting your personal data.
              This Privacy Policy explains what data we collect, how we use it, and your rights
              under applicable law including the General Data Protection Regulation (GDPR).
            </p>

            <div className="space-y-12">
              {sections.map((section) => (
                <div key={section.id} id={section.id} className="scroll-mt-28">
                  <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
                    {section.title}
                  </h2>
                  <div className="text-gray-600 leading-8 text-sm whitespace-pre-line">
                    {section.content}
                  </div>
                </div>
              ))}

              {/* Cookie inventory table */}
              <div id="cookie-table" className="scroll-mt-28">
                <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
                  Cookie inventory
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 border border-gray-100">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 border border-gray-100">Provider</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 border border-gray-100">Purpose</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 border border-gray-100">Expiry</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 border border-gray-100">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          name: "unslid_cookie_consent_v1",
                          provider: "Unslid (1st party)",
                          purpose: "Stores your cookie consent preferences",
                          expiry: "1 year (localStorage)",
                          type: "Essential",
                        },
                        {
                          name: "_ga",
                          provider: "Google Analytics",
                          purpose: "Distinguishes unique users. Only set after consent.",
                          expiry: "2 years",
                          type: "Analytics",
                        },
                        {
                          name: "_ga_*",
                          provider: "Google Analytics",
                          purpose: "Maintains session state. Only set after consent.",
                          expiry: "2 years",
                          type: "Analytics",
                        },
                      ].map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700 border border-gray-100">{row.name}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 border border-gray-100">{row.provider}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 border border-gray-100">{row.purpose}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 border border-gray-100 whitespace-nowrap">{row.expiry}</td>
                          <td className="px-4 py-3 border border-gray-100">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                              row.type === "Essential"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-amber-50 text-amber-700"
                            }`}>
                              {row.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-gray-400 leading-5">
                  Analytics cookies are only set after you click &quot;Accept all cookies&quot; in the consent banner.
                  To withdraw consent, clear this site&apos;s localStorage in your browser settings or contact{" "}
                  <a href="mailto:privacy@unslid.com" className="text-brand-600 hover:underline">
                    privacy@unslid.com
                  </a>.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
