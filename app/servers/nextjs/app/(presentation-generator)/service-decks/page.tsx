"use client";

import { onlinePresentationServiceDecks } from "@/app/presentation-decks/onlinePresentationServiceDecks";
import DashboardSidebar from "../(dashboard)/Components/DashboardSidebar";

export default function ServiceDecksPage() {
  return (
    <div className="flex h-dvh flex-col-reverse overflow-hidden bg-slate-50 md:flex-row">
      <DashboardSidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 border-b bg-white px-4 py-6 sm:px-8">
          <h1 className="text-3xl font-bold text-slate-950">100 Ready Presentation Service Decks</h1>
          <p className="mt-2 text-slate-600">
            Eye-catching 7-page deck concepts for selling online presentation services.
          </p>
        </header>

        <div className="grid gap-6 p-4 sm:p-8">
          {onlinePresentationServiceDecks.map((deck, index) => (
            <section key={deck.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
                <div>
                  <div className="text-sm font-semibold" style={{ color: deck.accent }}>
                    #{String(index + 1).padStart(3, "0")} • {deck.category} • {deck.style}
                  </div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">{deck.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-600">{deck.summary}</p>
                </div>
                <div className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: deck.accent }}>
                  {deck.slides.length} pages
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
                {deck.slides.map((slide, slideIndex) => (
                  <article key={`${deck.id}-${slideIndex}`} className="min-h-56 rounded-lg border p-5" style={{ borderColor: `${deck.accent}33` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Page {slideIndex + 1}
                      </span>
                      <span className="rounded px-2 py-1 text-xs font-semibold" style={{ background: `${deck.accent}18`, color: deck.accent }}>
                        {slide.visual}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-950">{slide.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{slide.subtitle}</p>
                    <ul className="mt-4 space-y-2 text-sm text-slate-700">
                      {slide.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: deck.accent }} />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
