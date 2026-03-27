import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms governing your use of our service.",
};

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Unslid";
const lastUpdated = "March 2026";

const sections = [
  {
    id: "eligibility",
    title: "1. Eligibility",
    content: `You must be at least 16 years old to use the Service. By using ${appName}, you represent that you meet this requirement and that you have the legal capacity to enter into these Terms.`,
  },
  {
    id: "account",
    title: "2. Account responsibilities",
    content: `You are responsible for:\n\n• Maintaining the confidentiality of your login credentials.\n• All activity that occurs under your account.\n• Ensuring your use complies with applicable law.\n\nYou must not share your account credentials with others or allow concurrent use by multiple people under a single account. Violation may result in suspension or termination.`,
  },
  {
    id: "acceptable-use",
    title: "3. Acceptable use",
    content: `You may not use the Service to:\n\n• Create or distribute illegal, harmful, or abusive content.\n• Infringe the intellectual property rights of others.\n• Attempt to reverse-engineer, copy, or resell the Service.\n• Circumvent rate limits, usage caps, or security measures.\n• Share account credentials with others (account sharing is prohibited and monitored).`,
  },
  {
    id: "billing",
    title: "4. Subscription and billing",
    content: `Paid plans are billed in advance on a monthly or annual basis. Subscriptions auto-renew unless cancelled before the renewal date. You may cancel at any time through your account settings or the Stripe Customer Portal.\n\nRefunds are handled on a case-by-case basis — contact support within 7 days of billing.\n\nThe Spark trial is a one-time payment that grants 7 days of Pro access. It does not auto-renew. After 7 days the account automatically reverts to Free.`,
  },
  {
    id: "ip",
    title: "5. Intellectual property",
    content: `You retain ownership of all content you create using the Service. By using the Service, you grant us a limited, non-exclusive licence to store and process your content solely to provide the Service.\n\nAll software, branding, designs, and intellectual property of ${appName} remains our exclusive property. You may not copy, modify, or distribute any part of the Service without written permission.`,
  },
  {
    id: "liability",
    title: "6. Limitations of liability",
    content: `The Service is provided "as is". To the maximum extent permitted by applicable law, ${appName} is not liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our total aggregate liability shall not exceed the amounts you have paid us in the 12 months preceding the claim.`,
  },
  {
    id: "termination",
    title: "7. Termination",
    content: `We may suspend or terminate your account if you violate these Terms. You may delete your account at any time from your account settings. Upon termination, your personal data is anonymised per our Privacy Policy within 30 days. Billing records may be retained for regulatory compliance.`,
  },
  {
    id: "changes",
    title: "8. Changes to Terms",
    content: `We may update these Terms from time to time. We will notify you of material changes by email or an in-app notification at least 14 days before they take effect. Continued use of the Service after the effective date constitutes acceptance of the updated Terms.`,
  },
  {
    id: "governing-law",
    title: "9. Governing law",
    content: `These Terms are governed by and construed in accordance with the laws of the jurisdiction in which ${appName} is incorporated, without regard to conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of that jurisdiction.`,
  },
  {
    id: "contact",
    title: "10. Contact",
    content: `For questions about these Terms, contact us at:\n\nlegal@unslid.com\n\nWe aim to respond to all legal enquiries within 5 business days.`,
  },
];

export default function TermsPage() {
  return (
    <div className="pt-24 bg-white">
      {/* Page header */}
      <div className="border-b border-gray-100 py-14 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-3">Legal</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">
            Terms of Service
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
              <div className="mt-8 pt-8 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-3">Related</p>
                <Link href="/privacy" className="block text-sm text-brand-600 hover:underline">
                  Privacy Policy &rarr;
                </Link>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 max-w-2xl">
            <p className="text-gray-600 leading-8 mb-10 text-base">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of {appName}{" "}
              (&quot;Service&quot;). By creating an account or using the Service, you agree to these Terms.
              If you do not agree, do not use the Service.
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
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
