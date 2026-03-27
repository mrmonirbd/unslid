import Link from "next/link";
import {
  ArrowRight,
  Check,
  Wand2,
  LayoutTemplate,
  Download,
  Users,
  Star,
  Zap,
  FileText,
  Globe,
  Lock,
} from "lucide-react";
import FaqAccordion from "@/components/FaqAccordion";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.unslid.com";
const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Unslid";

// ─── Data ─────────────────────────────────────────────────────────────────────

const plans = [
  {
    name: "Free",
    price: "$0",
    per: "",
    badge: null,
    description: "Try the tool with no commitment. No credit card required.",
    cta: "Get started free",
    highlight: false,
    features: [
      "1 active presentation slot",
      "Basic AI model",
      "10 built-in templates",
      "PPTX & PDF export",
      "Public sharing link",
    ],
    missing: ["Premium AI models", "Premium templates", "Team workspace"],
  },
  {
    name: "Pro",
    price: "$19",
    per: "/month",
    badge: "Most Popular",
    description: "For individuals who create presentations frequently.",
    cta: "Start Pro",
    highlight: true,
    features: [
      "Unlimited presentations",
      "Premium AI models (GPT-4, Gemini, Claude)",
      "200+ professional templates",
      "PPTX, PDF & share link export",
      "Password-protected sharing",
      "Custom aspect ratios",
      "Priority support",
    ],
    missing: ["Team workspace", "Seat management"],
  },
  {
    name: "Team",
    price: "$49",
    per: "/month",
    badge: null,
    description: "For teams that create and collaborate on presentations.",
    cta: "Start Team",
    highlight: false,
    features: [
      "Everything in Pro",
      "Shared team workspace",
      "Seat management & invites",
      "File permissions (team / private)",
      "Centralised AI model config",
      "Admin dashboard & usage stats",
      "Dedicated support",
    ],
    missing: [],
  },
];

const aiModels = [
  {
    name: "OpenAI GPT-4",
    detail: "Industry-leading language model for structured, high-quality outlines and narrative content.",
    badge: "Most Used",
  },
  {
    name: "Google Gemini",
    detail: "Fast multimodal model from Google. Excellent for image-aware slide generation.",
    badge: null,
  },
  {
    name: "Anthropic Claude",
    detail: "Long-context reasoning model. Great for complex documents and detailed analysis.",
    badge: null,
  },
  {
    name: "Ollama (local)",
    detail: "Run open-source models on your own hardware. Zero data sent to third parties.",
    badge: "Air-gapped",
  },
];

const featureRows = [
  {
    icon: Wand2,
    title: "AI that reads your source material",
    body: "Paste a URL, upload a PDF, paste raw text, or just describe a topic. The AI reads and understands your content, structures an outline automatically, and selects the best slide layouts — in seconds.",
    highlights: ["URL scraping", "PDF & document upload", "Topic-to-outline generation"],
    flip: false,
    color: "from-violet-500 to-brand-500",
  },
  {
    icon: LayoutTemplate,
    title: "Designer-quality templates for every occasion",
    body: "Choose from 200+ professionally designed templates spanning business, education, sales, and creative use cases. Every template is pixel-perfect — consistent typography, colours, and spacing.",
    highlights: ["200+ templates", "Free & premium tiers", "Admin-managed library"],
    flip: true,
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon: Download,
    title: "Export to any format, share anywhere",
    body: "Download as PPTX for editing in PowerPoint or Google Slides. Export as PDF for email or printing. Or share a live link — with optional password protection — that looks great on any device.",
    highlights: ["PPTX download", "PDF export", "Password-protected links"],
    flip: false,
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Users,
    title: "Built for teams from the ground up",
    body: "Team owners invite members by email, manage seats, and set file permissions. Each member gets their own workspace while sharing templates and AI config. Billing is centralised for the whole team.",
    highlights: ["Email invites", "Seat management", "Shared workspace"],
    flip: true,
    color: "from-orange-500 to-rose-500",
  },
];

const testimonials = [
  {
    body: "I cut my presentation prep time from 4 hours to under 20 minutes. The AI just gets what I need — every time.",
    author: "Sarah K.",
    role: "Product Manager, Series B startup",
    stars: 5,
  },
  {
    body: "We switched our entire sales team to this. The templates are stunning and the PPTX export is flawless in PowerPoint.",
    author: "Marcus R.",
    role: "VP of Sales, SaaS company",
    stars: 5,
  },
  {
    body: "The best AI presentation tool I've tried. Real competitor to Gamma but with better export quality and team features.",
    author: "Priya M.",
    role: "Founder",
    stars: 5,
  },
];

const faqs = [
  {
    question: "Do I need a credit card to start?",
    answer: "No. The Free plan requires no credit card. You only need payment details when upgrading to Pro or Team, or purchasing the Spark trial.",
  },
  {
    question: "What AI models are available?",
    answer: "Free users access a standard AI model. Pro and Team users can choose from OpenAI GPT-4, Google Gemini, Anthropic Claude, and more — configured centrally by your admin. You pick from a dropdown of active options.",
  },
  {
    question: "What is the Spark trial package?",
    answer: "Spark is a one-time $9.90 payment that grants 7 days of full Pro access — premium AI models, all templates, and unlimited exports. It does not auto-renew. After 7 days your account reverts to Free automatically.",
  },
  {
    question: "Can I switch plans at any time?",
    answer: "Yes. Upgrade instantly at any time. Downgrades take effect at the end of your current billing period. Team leaders can also reduce seat count after removing members.",
  },
  {
    question: "Is my data GDPR compliant?",
    answer: "Yes. EU users' files are stored in EU data centres (Wasabi eu-central-1). US users' data stays in the US. You are notified of your region at signup. You can export or delete all your data at any time from account settings.",
  },
  {
    question: "Can I use my own AI model API keys?",
    answer: "No — and that's by design. On paid plans, AI models are configured centrally by an admin so you never need to source or manage your own API keys. You just create.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      {/* ── SECTION 1: Hero ──────────────────────────────────────────────── */}
      <section className="bg-white pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-14 lg:gap-20">

            {/* Left: copy */}
            <div className="flex-1 lg:max-w-[560px]">
              {/* Eyebrow — plain text, no pill */}
              <p className="text-sm font-semibold text-brand-600 uppercase tracking-widest mb-6">
                Unslid Builder
              </p>

              {/* Headline — massive, near-black, tight tracking, no gradient */}
              <h1 className="hero-headline text-gray-950">
                Create professional
                <br />
                presentations with AI.
              </h1>

              {/* Sub-copy */}
              <p className="mt-6 text-lg text-gray-500 leading-8 max-w-lg">
                {appName} turns any URL, PDF, or idea into a fully designed
                presentation — outline, slides, images, and layout — in seconds.
              </p>

              {/* Bullet points — key selling points (RiotIQ style) */}
              <ul className="mt-8 space-y-3">
                {[
                  "Generates complete decks from URLs, PDFs, or topics",
                  "Professional templates from $0 — free plan included",
                  "Export to PPTX, PDF, or share a live link",
                  "Powered by GPT-4, Gemini, Claude, and more",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gray-950 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </span>
                    <span className="text-sm text-gray-700 leading-6">{point}</span>
                  </li>
                ))}
              </ul>

              {/* CTAs — dark primary button like RiotIQ */}
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <a
                  href={`${appUrl}/login`}
                  className="rounded-lg bg-gray-950 px-7 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
                >
                  Try it free
                </a>
                <Link
                  href="/pricing"
                  className="rounded-lg border border-gray-300 bg-white px-7 py-3.5 text-sm font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                >
                  See pricing
                </Link>
              </div>

              <p className="mt-4 text-xs text-gray-400">
                No credit card required &mdash; start for free today
              </p>
            </div>

            {/* Right: polished app mockup */}
            <div className="flex-1 w-full">
              <div className="relative">
                {/* Main browser window */}
                <div className="rounded-xl border border-gray-200 shadow-2xl overflow-hidden bg-white ring-1 ring-gray-100">
                  {/* Browser chrome bar */}
                  <div className="flex items-center gap-2 bg-[#f5f5f7] border-b border-gray-200 px-4 py-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                      <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                      <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="ml-3 flex-1 bg-white border border-gray-200 rounded-md px-3 h-6 flex items-center">
                      <div className="w-3 h-3 rounded-full border border-gray-300 mr-2 flex-shrink-0" />
                      <span className="text-[11px] text-gray-400 truncate">app.unslid.com/dashboard</span>
                    </div>
                  </div>

                  {/* App UI */}
                  <div className="bg-[#fafafa] p-5">
                    {/* Top bar */}
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="h-3.5 bg-gray-900 rounded w-28 mb-1.5" />
                        <div className="h-2.5 bg-gray-200 rounded w-40" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-24 rounded-lg bg-gray-950 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-white">+ New deck</span>
                        </div>
                      </div>
                    </div>

                    {/* Presentation cards */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {[
                        { title: "Q4 Strategy", sub: "18 slides", bg: "bg-gray-900" },
                        { title: "Product Launch", sub: "12 slides", bg: "bg-brand-600" },
                        { title: "Investor Deck", sub: "24 slides", bg: "bg-gray-700" },
                      ].map((card, i) => (
                        <div key={i} className="rounded-lg overflow-hidden shadow-sm border border-gray-100">
                          <div className={`${card.bg} aspect-video p-3 flex flex-col justify-between`}>
                            <div className="w-5 h-0.5 rounded bg-white/30" />
                            <div className="space-y-1">
                              <div className="h-1 bg-white/40 rounded w-full" />
                              <div className="h-1 bg-white/25 rounded w-4/5" />
                            </div>
                          </div>
                          <div className="bg-white px-2.5 py-2">
                            <p className="text-[10px] font-semibold text-gray-800 truncate">{card.title}</p>
                            <p className="text-[9px] text-gray-400">{card.sub}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Generate input row */}
                    <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5 flex items-center gap-3 shadow-sm">
                      <div className="w-6 h-6 rounded-md bg-gray-950 flex items-center justify-center flex-shrink-0">
                        <Wand2 className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-gray-100 rounded w-2/3" />
                      </div>
                      <div className="text-[10px] font-bold text-white bg-gray-950 px-3 py-1.5 rounded-md flex-shrink-0">
                        Generate
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badge — bottom right */}
                <div className="absolute -bottom-4 -right-4 bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Deck ready</p>
                    <p className="text-[10px] text-gray-400">Generated in 18 seconds</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SECTION 2: Trust bar ─────────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-10">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">
            Powered by world-class AI providers
          </p>
          <div className="flex flex-wrap justify-center items-center gap-x-14 gap-y-6">
            {["OpenAI", "Google Gemini", "Anthropic", "Pexels", "Pixabay"].map((name) => (
              <span key={name} className="text-base font-bold text-gray-300 tracking-tight">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: Plans grid ────────────────────────────────────────── */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-14">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-3">
              Plans &amp; pricing
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Explore all plans
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl">
              Every plan includes PPTX &amp; PDF export and a public share link. Upgrade anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl flex flex-col p-8 transition-shadow ${
                  plan.highlight
                    ? "bg-brand-600 text-white shadow-2xl shadow-brand-200 ring-2 ring-brand-500"
                    : "bg-white border border-gray-200 shadow-sm hover:shadow-md"
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
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlight ? "text-brand-200" : "text-gray-500"}`}>
                    {plan.per}
                  </span>
                </div>
                <p className={`text-sm mb-8 ${plan.highlight ? "text-brand-200" : "text-gray-500"}`}>
                  {plan.description}
                </p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlight ? "text-brand-200" : "text-emerald-500"}`} />
                      <span className={`text-sm ${plan.highlight ? "text-white" : "text-gray-700"}`}>{f}</span>
                    </li>
                  ))}
                  {plan.missing.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 opacity-40">
                      <div className={`w-4 h-4 flex-shrink-0 mt-0.5 flex items-center justify-center`}>
                        <div className={`w-3 h-px ${plan.highlight ? "bg-brand-300" : "bg-gray-400"}`} />
                      </div>
                      <span className={`text-sm ${plan.highlight ? "text-brand-300" : "text-gray-400"}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={`${appUrl}/login`}
                  className={`rounded-xl py-3 text-sm font-semibold text-center transition-colors ${
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

          {/* Spark trial card */}
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center flex-shrink-0 shadow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <span className="text-lg font-bold text-gray-900">Spark Trial</span>
                <span className="text-xl font-extrabold text-gray-900">$9.90</span>
                <span className="text-xs text-gray-500 font-medium border border-gray-300 rounded-full px-2 py-0.5">one-time</span>
              </div>
              <p className="text-sm text-gray-600">
                7 days of full Pro access. Premium AI models, all templates, unlimited exports.
                No subscription — reverts to Free automatically after expiry.
              </p>
            </div>
            <a
              href={`${appUrl}/settings/billing`}
              className="flex-shrink-0 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
            >
              Get Spark Access
            </a>
          </div>

          <p className="mt-6 text-sm text-gray-500 text-center">
            Full feature comparison on the{" "}
            <Link href="/pricing" className="text-brand-600 hover:underline font-medium">
              pricing page
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── SECTION 4: About ─────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-24 sm:py-32 border-y border-gray-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left: text */}
            <div className="flex-1 max-w-xl">
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-4">
                What is {appName}?
              </p>
              <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-6">
                The AI presentation builder built for professionals
              </h2>
              <p className="text-gray-600 leading-8 mb-6">
                {appName} is a web-based AI tool that turns any source material — a document,
                a URL, or a plain-text idea — into a fully designed presentation. It handles
                the outline, the copy, the images, and the layout so you can focus on the content
                that matters.
              </p>
              <p className="text-gray-600 leading-8 mb-10">
                Unlike generic AI tools, {appName} is purpose-built for presentations.
                Every model, template, and export option has been optimised specifically
                for slide decks — not blog posts or emails.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "AI models supported", value: "6+" },
                  { label: "Professional templates", value: "200+" },
                  { label: "Export formats", value: "3" },
                  { label: "Data regions (GDPR)", value: "EU & US" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-white border border-gray-200 p-4">
                    <div className="text-2xl font-extrabold text-brand-600 mb-1">{value}</div>
                    <div className="text-xs text-gray-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: feature grid mockup */}
            <div className="flex-1 w-full max-w-md lg:max-w-none">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: FileText, label: "Document upload", desc: "PDF, Word, TXT" },
                  { icon: Globe, label: "URL import", desc: "Scrape any webpage" },
                  { icon: Wand2, label: "AI outline", desc: "Instant structure" },
                  { icon: LayoutTemplate, label: "200+ templates", desc: "Free & premium" },
                  { icon: Download, label: "PPTX & PDF", desc: "Perfect exports" },
                  { icon: Lock, label: "GDPR ready", desc: "EU data in EU" },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="rounded-xl bg-white border border-gray-100 p-5 shadow-sm">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mb-3">
                      <Icon className="w-4.5 h-4.5 text-brand-600 w-[18px] h-[18px]" />
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: Alternating feature rows ──────────────────────────── */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-20">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-4">
              Features
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Everything in one place
            </h2>
          </div>

          <div className="space-y-28">
            {featureRows.map(({ icon: Icon, title, body, highlights, flip, color }) => (
              <div
                key={title}
                className={`flex flex-col ${flip ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-14`}
              >
                {/* Text side */}
                <div className="flex-1 max-w-lg">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md mb-6`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">{title}</h3>
                  <p className="text-gray-600 leading-8 mb-8">{body}</p>
                  <ul className="space-y-2">
                    {highlights.map((h) => (
                      <li key={h} className="flex items-center gap-3 text-sm font-medium text-gray-700">
                        <Check className="w-4 h-4 text-brand-500 flex-shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual side */}
                <div className="flex-1 w-full max-w-md">
                  <div className={`rounded-2xl bg-gradient-to-br ${color} p-px shadow-2xl`}>
                    <div className="rounded-2xl bg-white p-8 flex items-center justify-center min-h-56">
                      <div className="w-full space-y-3">
                        <div className={`h-3 rounded-full bg-gradient-to-r ${color} w-3/4`} />
                        <div className="h-2 rounded bg-gray-100 w-full" />
                        <div className="h-2 rounded bg-gray-100 w-5/6" />
                        <div className="h-2 rounded bg-gray-100 w-4/6" />
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          {[1, 2, 3].map((n) => (
                            <div key={n} className={`rounded-lg bg-gradient-to-br ${color} opacity-${n === 1 ? "100" : n === 2 ? "60" : "30"} h-16`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: AI model foundation ───────────────────────────────── */}
      <section className="bg-gray-50 py-24 sm:py-32 border-y border-gray-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl mb-14">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-4">
              AI foundation
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-4">
              Built on world-class AI
            </h2>
            <p className="text-gray-600 leading-8">
              {appName} connects to the best AI models available. Admins configure
              which models are active — users pick from the enabled options or let the system
              choose the best one automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {aiModels.map(({ name, detail, badge }) => (
              <div key={name} className="relative rounded-2xl bg-white border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                {badge && (
                  <span className="absolute -top-3 left-5 text-xs font-bold uppercase tracking-widest bg-brand-600 text-white px-3 py-1 rounded-full">
                    {badge}
                  </span>
                )}
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-4">
                  <Zap className="w-5 h-5 text-brand-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{name}</h3>
                <p className="text-sm text-gray-500 leading-6">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7: Testimonials ───────────────────────────────────────── */}
      <section className="bg-gray-950 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              Loved by presenters worldwide
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.author} className="rounded-2xl bg-gray-900 border border-gray-800 p-8 flex flex-col">
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-7 flex-1 mb-6">
                  &ldquo;{t.body}&rdquo;
                </p>
                <div className="border-t border-gray-800 pt-4">
                  <div className="text-white font-semibold text-sm">{t.author}</div>
                  <div className="text-gray-500 text-xs mt-0.5">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 8: FAQ ───────────────────────────────────────────────── */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <div className="mb-12">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-4">
              FAQ
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
              Still have questions?
            </h2>
          </div>
          <FaqAccordion items={faqs} />
          <p className="mt-8 text-sm text-gray-500">
            Can&apos;t find the answer?{" "}
            <a href="mailto:hello@unslid.com" className="text-brand-600 hover:underline font-medium">
              Contact us
            </a>{" "}
            and we&apos;ll get back to you quickly.
          </p>
        </div>
      </section>

      {/* ── SECTION 9: Final CTA ─────────────────────────────────────────── */}
      <section className="bg-gray-950 py-24">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <h2 className="hero-headline text-white mb-6">
            Create your first AI
            <br />
            presentation today.
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto leading-8">
            Join thousands of teams using {appName} to build beautiful decks in
            minutes, not hours. Free plan available.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={`${appUrl}/login`}
              className="rounded-lg bg-white px-8 py-3.5 text-sm font-bold text-gray-950 hover:bg-gray-100 transition-colors"
            >
              Try it free
            </a>
            <Link
              href="/pricing"
              className="rounded-lg border border-gray-700 px-8 py-3.5 text-sm font-semibold text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
            >
              See pricing
            </Link>
          </div>
          <div className="mt-10 flex justify-center flex-wrap gap-8">
            {["No credit card required", "Cancel anytime", "GDPR compliant"].map((t) => (
              <div key={t} className="flex items-center gap-2 text-sm text-gray-500">
                <Check className="w-4 h-4 text-gray-400" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
