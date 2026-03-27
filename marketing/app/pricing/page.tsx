import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, Zap } from "lucide-react";
import FaqAccordion from "@/components/FaqAccordion";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing. Start free and upgrade when you need to.",
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.unslid.com";

// ─── Data ─────────────────────────────────────────────────────────────────────

const plans = [
  {
    name: "Free",
    price: "$0",
    per: "",
    description: "Perfect for trying it out. No credit card required.",
    cta: "Get started",
    highlight: false,
    badge: null,
  },
  {
    name: "Pro",
    price: "$19",
    per: "/month",
    annual: "$15/month, billed annually",
    description: "For individuals who create presentations regularly.",
    cta: "Start Pro",
    highlight: true,
    badge: "Most popular",
  },
  {
    name: "Team",
    price: "$49",
    per: "/month",
    annual: "$39/month, billed annually",
    description: "For teams that create and collaborate on presentations.",
    cta: "Start Team",
    highlight: false,
    badge: null,
  },
];

type Status = "yes" | "no" | "partial" | string;

interface Feature {
  label: string;
  free: Status;
  pro: Status;
  team: Status;
  section?: string;
}

const comparisonFeatures: Feature[] = [
  // Presentations
  { label: "Active presentations", free: "1 slot", pro: "Unlimited", team: "Unlimited", section: "Presentations" },
  { label: "Slides per presentation", free: "yes", pro: "yes", team: "yes" },
  { label: "Monthly presentation reset", free: "yes", pro: "yes", team: "yes" },

  // AI
  { label: "Basic AI model", free: "yes", pro: "yes", team: "yes", section: "AI Models" },
  { label: "Premium AI (GPT-4, Gemini, Claude)", free: "no", pro: "yes", team: "yes" },
  { label: "AI model selection dropdown", free: "no", pro: "yes", team: "yes" },
  { label: "Image generation (DALL·E, Gemini)", free: "no", pro: "yes", team: "yes" },

  // Templates
  { label: "Built-in templates", free: "10", pro: "200+", team: "200+", section: "Templates" },
  { label: "Premium designer templates", free: "no", pro: "yes", team: "yes" },

  // Export & Share
  { label: "PPTX export", free: "yes", pro: "yes", team: "yes", section: "Export & Share" },
  { label: "PDF export", free: "yes", pro: "yes", team: "yes" },
  { label: "Public share link", free: "yes", pro: "yes", team: "yes" },
  { label: "Password-protected sharing", free: "no", pro: "yes", team: "yes" },
  { label: "Custom aspect ratios", free: "no", pro: "yes", team: "yes" },

  // Teams
  { label: "Shared team workspace", free: "no", pro: "no", team: "yes", section: "Teams" },
  { label: "Email invites", free: "no", pro: "no", team: "yes" },
  { label: "Seat management & billing", free: "no", pro: "no", team: "yes" },
  { label: "File permissions (team / private)", free: "no", pro: "no", team: "yes" },
  { label: "Admin dashboard & usage stats", free: "no", pro: "no", team: "yes" },

  // Support
  { label: "Community support", free: "yes", pro: "yes", team: "yes", section: "Support" },
  { label: "Priority support", free: "no", pro: "yes", team: "yes" },
  { label: "Dedicated support", free: "no", pro: "no", team: "yes" },
];

const faqs = [
  {
    question: "Do I need a credit card to start?",
    answer: "No. The Free plan requires no credit card at all. You only need payment details when upgrading to Pro, Team, or purchasing the Spark trial.",
  },
  {
    question: "What happens to my presentations if I downgrade?",
    answer: "Your presentations are never deleted when you downgrade. On the Free plan you can access all existing presentations but can only have 1 active slot going forward. You can export or delete old ones at any time.",
  },
  {
    question: "What is the Spark trial and how does it work?",
    answer: "Spark is a one-time $9.90 payment. It grants 7 days of full Pro access — premium AI models, all templates, and unlimited exports. There is no subscription and no auto-renewal. After 7 days your account automatically reverts to Free.",
  },
  {
    question: "Can I switch from Pro to Team?",
    answer: "Yes. When you upgrade from Pro to Team you become the team owner and are required to purchase at least 2 seats. All your existing presentations carry over and become accessible with team permission settings.",
  },
  {
    question: "How does Team billing work?",
    answer: "Team plans are billed per seat. The team owner manages billing. To reduce your seat count, remove members first, then select the lower seat number. If you reduce to 1 seat the plan automatically converts back to Pro.",
  },
  {
    question: "Is my data stored in the EU?",
    answer: "EU users' files are automatically stored in EU data centres (Wasabi eu-central-1). US users' data stays in US data centres. You are notified of your region at signup. You can export or delete all your data at any time.",
  },
  {
    question: "Can I get a refund?",
    answer: "Refunds are handled on a case-by-case basis. Contact support within 7 days of billing and we'll review your request promptly.",
  },
];

function StatusCell({ value }: { value: Status }) {
  if (value === "yes") {
    return <Check className="w-5 h-5 text-emerald-500 mx-auto" />;
  }
  if (value === "no") {
    return <Minus className="w-5 h-5 text-gray-300 mx-auto" />;
  }
  return <span className="text-sm font-medium text-gray-700">{value}</span>;
}

export default function PricingPage() {
  let currentSection = "";

  return (
    <div className="pt-24">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-4">Pricing</p>
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-6 text-lg text-gray-600">
            Start free. No hidden fees. Upgrade when you&apos;re ready.
          </p>
        </div>
      </section>

      {/* ── Plan cards ──────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16 border-y border-gray-100">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl flex flex-col p-8 ${
                  plan.highlight
                    ? "bg-brand-600 text-white shadow-2xl shadow-brand-200 ring-2 ring-brand-500"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}
              >
                {plan.badge && (
                  <span className={`absolute -top-3 left-6 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                    plan.highlight ? "bg-white text-brand-700" : "bg-brand-600 text-white"
                  }`}>
                    {plan.badge}
                  </span>
                )}

                <div className={`text-2xl font-bold mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlight ? "text-brand-200" : "text-gray-500"}`}>
                    {plan.per}
                  </span>
                </div>
                {"annual" in plan && plan.annual && (
                  <p className={`text-xs mb-2 ${plan.highlight ? "text-brand-300" : "text-gray-400"}`}>
                    {plan.annual}
                  </p>
                )}
                <p className={`text-sm mb-8 ${plan.highlight ? "text-brand-200" : "text-gray-500"}`}>
                  {plan.description}
                </p>

                <a
                  href={`${appUrl}/login`}
                  className={`mt-auto rounded-xl py-3 text-sm font-semibold text-center transition-colors ${
                    plan.highlight
                      ? "bg-white text-brand-700 hover:bg-brand-50"
                      : "bg-brand-600 text-white hover:bg-brand-700"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>

          {/* Spark trial */}
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0 shadow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <span className="text-lg font-bold text-gray-900">Spark Trial</span>
                <span className="text-xl font-extrabold text-gray-900">$9.90</span>
                <span className="text-xs text-gray-500 border border-gray-300 rounded-full px-2 py-0.5 font-medium">one-time payment</span>
              </div>
              <p className="text-sm text-gray-600">
                7 days of full Pro access. Premium AI models, all templates, unlimited exports.
                No subscription — reverts to Free automatically. No manual cancellation needed.
              </p>
            </div>
            <a
              href={`${appUrl}/settings/billing`}
              className="flex-shrink-0 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              Get Spark Access
            </a>
          </div>
        </div>
      </section>

      {/* ── Feature comparison table ─────────────────────────────────────── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-10">Full feature comparison</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 pr-6 font-semibold text-gray-900 w-1/2">Feature</th>
                  {plans.map((p) => (
                    <th key={p.name} className={`text-center py-4 px-4 font-bold ${p.highlight ? "text-brand-600" : "text-gray-700"}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((feature) => {
                  const showSection = feature.section && feature.section !== currentSection;
                  if (feature.section) currentSection = feature.section;

                  return (
                    <>
                      {showSection && (
                        <tr key={`section-${feature.section}`}>
                          <td colSpan={4} className="pt-8 pb-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-brand-600">
                              {feature.section}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr key={feature.label} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 pr-6 text-gray-700">{feature.label}</td>
                        {[feature.free, feature.pro, feature.team].map((val, i) => (
                          <td key={i} className="py-3.5 px-4 text-center">
                            <StatusCell value={val} />
                          </td>
                        ))}
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-20 border-t border-gray-100">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <div className="mb-12">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-4">FAQ</p>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900">
              Frequently asked questions
            </h2>
          </div>
          <FaqAccordion items={faqs} />
          <p className="mt-8 text-sm text-gray-500">
            Still have questions?{" "}
            <a href="mailto:hello@unslid.com" className="text-brand-600 hover:underline font-medium">
              Contact us
            </a>
            .
          </p>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <section className="bg-brand-600 py-16 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-extrabold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-brand-200 mb-8">
            Free plan available. No credit card required. Upgrade anytime.
          </p>
          <a
            href={`${appUrl}/login`}
            className="inline-block rounded-xl bg-white px-10 py-4 text-sm font-bold text-brand-700 hover:bg-brand-50 transition-colors"
          >
            Start for free
          </a>
        </div>
      </section>
    </div>
  );
}
