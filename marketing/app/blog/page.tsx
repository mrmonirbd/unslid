import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog",
  description: "Tips, tutorials, and news about AI presentations and productivity.",
};

const posts = [
  {
    slug: "how-ai-is-changing-presentations",
    title: "How AI Is Changing the Way We Create Presentations",
    excerpt: "From manual slide-building to AI-powered generation — the future of presentations is here and faster than ever.",
    category: "Insights",
    date: "March 2026",
    readTime: "5 min read",
    featured: true,
  },
  {
    slug: "tips-for-better-ai-prompts",
    title: "10 Tips for Writing Better Unslid Prompts",
    excerpt: "The quality of your AI output depends on the quality of your input. Learn how to craft prompts that generate outstanding decks.",
    category: "Tutorial",
    date: "March 2026",
    readTime: "7 min read",
  },
  {
    slug: "team-presentations-best-practices",
    title: "Best Practices for Collaborative Team Presentations",
    excerpt: "Managing presentations across a team can be chaotic. Here's how to use permissions, shared workspaces, and version control to stay organised.",
    category: "Teams",
    date: "February 2026",
    readTime: "6 min read",
  },
  {
    slug: "gdpr-data-storage-presentations",
    title: "GDPR and Your Presentation Data: What You Need to Know",
    excerpt: "Data residency matters. We explain how geo-based storage keeps EU users compliant and their data safe.",
    category: "Compliance",
    date: "February 2026",
    readTime: "4 min read",
  },
  {
    slug: "pptx-vs-pdf-export-guide",
    title: "PPTX vs PDF: Which Export Format Should You Use?",
    excerpt: "Both formats have their place. Here's a practical guide to choosing the right export for every situation.",
    category: "Tutorial",
    date: "January 2026",
    readTime: "3 min read",
  },
  {
    slug: "comparing-ai-models-presentations",
    title: "GPT-4 vs Gemini vs Claude: Which AI Makes Better Slides?",
    excerpt: "We tested the top AI models on the same presentation prompt. The results might surprise you.",
    category: "Comparison",
    date: "January 2026",
    readTime: "8 min read",
  },
];

const categoryColors: Record<string, string> = {
  Insights:   "bg-blue-50 text-blue-700 border border-blue-100",
  Tutorial:   "bg-emerald-50 text-emerald-700 border border-emerald-100",
  Teams:      "bg-violet-50 text-violet-700 border border-violet-100",
  Compliance: "bg-orange-50 text-orange-700 border border-orange-100",
  Comparison: "bg-rose-50 text-rose-700 border border-rose-100",
};

export default function BlogPage() {
  const [featured, ...rest] = posts;

  return (
    <div className="pt-24">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-16 border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-4">Blog</p>
          <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
            Insights &amp; tutorials
          </h1>
          <p className="text-lg text-gray-600 max-w-xl">
            Tips, trends, and deep dives on AI presentations, productivity, and team collaboration.
          </p>
        </div>
      </section>

      {/* ── Featured post ───────────────────────────────────────────────── */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">Featured</p>
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row gap-0">
              {/* Colour block */}
              <div className="md:w-80 flex-shrink-0 bg-gradient-to-br from-brand-50 to-indigo-100 flex items-center justify-center p-12 min-h-48">
                <span className="text-7xl font-black text-brand-200 select-none">AI</span>
              </div>
              {/* Content */}
              <div className="p-8 md:p-10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <span className={`text-xs font-semibold rounded-full px-3 py-1 ${categoryColors[featured.category] ?? "bg-gray-100 text-gray-600"}`}>
                      {featured.category}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" /> {featured.date}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> {featured.readTime}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-snug">
                    {featured.title}
                  </h2>
                  <p className="text-gray-600 leading-7">{featured.excerpt}</p>
                </div>
                <div className="mt-8">
                  <Link
                    href={`/blog/${featured.slug}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                  >
                    Read article <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Post grid ───────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-12 border-t border-gray-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">All articles</p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <article
                key={post.slug}
                className="rounded-2xl border border-gray-100 bg-white p-6 flex flex-col shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-xs font-semibold rounded-full px-3 py-1 ${categoryColors[post.category] ?? "bg-gray-100 text-gray-600"}`}>
                    {post.category}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-3 leading-snug flex-1">
                  {post.title}
                </h3>
                <p className="text-sm text-gray-500 leading-6 mb-5">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Clock className="w-3 h-3" /> {post.readTime}
                  </span>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                  >
                    Read <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
