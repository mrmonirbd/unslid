import React from "react";
import * as z from "zod";
import { onlinePresentationServiceDecks } from "../../presentation-decks/onlinePresentationServiceDecks";
import { createTemplateEntry, TemplateLayoutsWithSettings, TemplateWithData } from "../utils";

type MegaKind =
  | "hero"
  | "split"
  | "metrics"
  | "timeline"
  | "comparison"
  | "process"
  | "quote"
  | "team"
  | "table"
  | "chart"
  | "roadmap"
  | "swot"
  | "pyramid"
  | "funnel"
  | "matrix"
  | "agenda"
  | "caseStudy"
  | "pricing"
  | "risk"
  | "dashboard"
  | "map"
  | "featureGrid"
  | "beforeAfter"
  | "thankYou"
  | "portfolio";

type MegaConfig = {
  id: string;
  name: string;
  description: string;
  kind: MegaKind;
  accent: string;
  bg: string;
  fg: string;
  soft: string;
  imageUrl: string;
  curve: number;
};

const baseItems = [
  { label: "Discovery", text: "Clarify the context, users, constraints, and measurable outcome." },
  { label: "Design", text: "Shape the system into a focused plan with clear tradeoffs." },
  { label: "Build", text: "Deliver the highest-leverage pieces first and keep feedback close." },
  { label: "Scale", text: "Turn the first working version into a repeatable operating rhythm." },
];

const baseMetrics = [
  { label: "Growth", value: "42%", note: "Year over year" },
  { label: "Cost", value: "-18%", note: "Operational savings" },
  { label: "NPS", value: "67", note: "Customer score" },
  { label: "Speed", value: "3.2x", note: "Faster delivery" },
];

const baseRows = [
  { label: "Market", value: "Expanding", note: "New segments opening" },
  { label: "Product", value: "Ready", note: "Core workflow validated" },
  { label: "Team", value: "Aligned", note: "Owners assigned" },
  { label: "Risk", value: "Managed", note: "Mitigations in place" },
];

function makeSchema(title: string, imageUrl: string) {
  return z.object({
    title: z.string().max(80).default(title),
    subtitle: z.string().max(180).default("A concise narrative slide for business, product, strategy, and data storytelling."),
    quote: z.string().max(180).default("The best slide makes the next decision feel obvious."),
    imageUrl: z.string().default(imageUrl),
    items: z.array(z.object({
      label: z.string().max(40),
      text: z.string().max(160),
    })).default(baseItems),
    metrics: z.array(z.object({
      label: z.string().max(30),
      value: z.string().max(24),
      note: z.string().max(80),
    })).default(baseMetrics),
    rows: z.array(z.object({
      label: z.string().max(36),
      value: z.string().max(42),
      note: z.string().max(100),
    })).default(baseRows),
  });
}

const textStyle = { letterSpacing: 0 };

const Shell = ({ cfg, children }: { cfg: MegaConfig; children: React.ReactNode }) => (
  <div
    className="relative mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] overflow-hidden rounded-sm shadow-lg"
    style={{ background: cfg.bg, color: cfg.fg, fontFamily: "Inter, Arial, sans-serif" }}
  >
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-80" viewBox="0 0 1280 720" preserveAspectRatio="none">
      {cfg.curve % 4 === 0 && <path d="M0 560 C220 450 360 690 610 555 C830 435 970 545 1280 410 L1280 720 L0 720 Z" fill={cfg.soft} />}
      {cfg.curve % 4 === 1 && <path d="M780 0 C900 140 1120 70 1280 210 L1280 0 Z" fill={cfg.soft} />}
      {cfg.curve % 4 === 2 && <path d="M0 0 C210 110 270 270 145 455 C90 535 45 625 0 720 Z" fill={cfg.soft} />}
      {cfg.curve % 4 === 3 && <path d="M360 720 C490 520 780 670 940 420 C1040 260 1160 220 1280 240 L1280 720 Z" fill={cfg.soft} />}
      <circle cx={cfg.curve % 2 ? 1060 : 180} cy={cfg.curve % 3 ? 140 : 560} r="86" fill={cfg.accent} opacity="0.12" />
    </svg>
    <div className="absolute left-0 top-0 h-full w-2" style={{ background: cfg.accent }} />
    <div className="absolute right-8 top-8 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: cfg.soft, color: cfg.fg }}>
      {cfg.name}
    </div>
    {children}
  </div>
);

const MetricCard = ({ metric, cfg }: { metric: { label: string; value: string; note: string }; cfg: MegaConfig }) => (
  <div className="rounded-lg p-5" style={{ background: cfg.soft }}>
    <div className="text-sm font-semibold opacity-75">{metric.label}</div>
    <div className="mt-2 text-5xl font-black" style={{ color: cfg.accent, ...textStyle }}>{metric.value}</div>
    <div className="mt-2 text-sm opacity-80">{metric.note}</div>
  </div>
);

const MiniBars = ({ cfg }: { cfg: MegaConfig }) => (
  <div className="flex h-56 items-end gap-4">
    {[42, 68, 52, 86, 74, 94].map((value, index) => (
      <div key={index} className="flex flex-1 flex-col items-center gap-3">
        <div className="w-full rounded-t-md" style={{ height: `${value}%`, background: index % 2 ? cfg.accent : cfg.soft }} />
        <span className="text-xs font-semibold opacity-70">Q{index + 1}</span>
      </div>
    ))}
  </div>
);

function renderLayout(cfg: MegaConfig, data: z.infer<ReturnType<typeof makeSchema>>) {
  const title = data.title;
  const subtitle = data.subtitle;
  const items = data.items?.length ? data.items : baseItems;
  const metrics = data.metrics?.length ? data.metrics : baseMetrics;
  const rows = data.rows?.length ? data.rows : baseRows;

  switch (cfg.kind) {
    case "hero":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[1.1fr_0.9fr] gap-10 p-16">
            <div className="flex flex-col justify-center">
              <div className="mb-5 h-2 w-28 rounded-full" style={{ background: cfg.accent }} />
              <h1 className="text-6xl font-black leading-[1.02]" style={textStyle}>{title}</h1>
              <p className="mt-6 max-w-xl text-2xl leading-snug opacity-80">{subtitle}</p>
            </div>
            <img src={data.imageUrl} alt="" className="h-full w-full rounded-xl object-cover" />
          </div>
        </Shell>
      );
    case "split":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-center p-16">
              <h1 className="text-5xl font-black leading-tight" style={textStyle}>{title}</h1>
              <p className="mt-5 text-xl leading-relaxed opacity-80">{subtitle}</p>
            </div>
            <div className="relative p-12">
              <img src={data.imageUrl} alt="" className="h-full w-full rounded-[32px] object-cover" />
              <div className="absolute bottom-16 left-4 grid w-[86%] grid-cols-2 gap-4">
                {items.slice(0, 4).map((item, index) => (
                  <div key={index} className="rounded-lg bg-white/90 p-4 shadow-sm backdrop-blur">
                    <div className="text-2xl font-black" style={{ color: cfg.accent }}>0{index + 1}</div>
                    <h3 className="mt-2 text-lg font-bold text-slate-950">{item.label}</h3>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Shell>
      );
    case "metrics":
      return (
        <Shell cfg={cfg}>
          <div className="flex h-full w-full flex-col p-14">
            <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
            <p className="mt-3 text-xl opacity-75">{subtitle}</p>
            <div className="mt-12 grid grid-cols-4 gap-5">
              {metrics.slice(0, 4).map((metric, index) => <MetricCard key={index} metric={metric} cfg={cfg} />)}
            </div>
          </div>
        </Shell>
      );
    case "timeline":
    case "roadmap":
      return (
        <Shell cfg={cfg}>
          <div className="flex h-full w-full flex-col p-16">
            <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
            <div className="relative mt-16 grid grid-cols-4 gap-8">
              <svg className="absolute left-0 right-0 top-4 h-24 w-full" viewBox="0 0 1000 120" preserveAspectRatio="none">
                <path d="M0 72 C160 8 260 112 410 56 C560 0 650 110 820 46 C900 16 950 34 1000 22" fill="none" stroke={cfg.accent} strokeWidth="6" strokeLinecap="round" />
              </svg>
              {items.slice(0, 4).map((item, index) => (
                <div key={index} className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white" style={{ background: cfg.accent }}>{index + 1}</div>
                  <h3 className="mt-8 text-2xl font-bold">{item.label}</h3>
                  <p className="mt-3 text-base leading-relaxed opacity-75">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "comparison":
    case "beforeAfter":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.85fr_1.15fr] gap-10 p-16">
            <div className="flex flex-col justify-center">
              <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
              <p className="mt-5 text-xl leading-relaxed opacity-75">{subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              {["Current State", "Target State"].map((heading, index) => (
                <div key={heading} className="rounded-xl p-8" style={{ background: index ? cfg.accent : cfg.soft, color: index ? "#fff" : cfg.fg }}>
                  <h2 className="text-3xl font-black">{heading}</h2>
                  {items.slice(index * 2, index * 2 + 2).map((item) => (
                    <div key={item.label} className="mt-8">
                      <h3 className="text-xl font-bold">{item.label}</h3>
                      <p className="mt-2 text-sm leading-relaxed opacity-80">{item.text}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "chart":
    case "dashboard":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.9fr_1.1fr] gap-10 p-16">
            <div>
              <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
              <p className="mt-5 text-xl leading-relaxed opacity-75">{subtitle}</p>
              <div className="mt-10 grid grid-cols-2 gap-4">
                {metrics.slice(0, 4).map((metric, index) => <MetricCard key={index} metric={metric} cfg={cfg} />)}
              </div>
            </div>
            <div className="rounded-xl p-8" style={{ background: cfg.soft }}>
              <MiniBars cfg={cfg} />
              <svg className="mt-6 h-20 w-full" viewBox="0 0 520 100" preserveAspectRatio="none">
                <path d="M0 78 C90 12 145 84 225 38 C310 -10 360 72 430 28 C470 4 500 15 520 8" fill="none" stroke={cfg.accent} strokeWidth="8" strokeLinecap="round" />
              </svg>
              <div className="mt-8 grid grid-cols-3 gap-4">
                {rows.slice(0, 3).map((row) => <div key={row.label}><div className="text-sm opacity-60">{row.label}</div><div className="text-2xl font-black">{row.value}</div></div>)}
              </div>
            </div>
          </div>
        </Shell>
      );
    case "table":
      return (
        <Shell cfg={cfg}>
          <div className="flex h-full w-full flex-col p-14">
            <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
            <div className="mt-10 overflow-hidden rounded-xl border" style={{ borderColor: cfg.soft }}>
              {rows.map((row, index) => (
                <div key={row.label} className="grid grid-cols-[0.8fr_0.8fr_1.4fr] gap-6 px-8 py-5" style={{ background: index % 2 ? "transparent" : cfg.soft }}>
                  <strong>{row.label}</strong>
                  <span style={{ color: cfg.accent }} className="font-bold">{row.value}</span>
                  <span className="opacity-75">{row.note}</span>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "pricing":
      return (
        <Shell cfg={cfg}>
          <div className="flex h-full w-full flex-col p-14">
            <div className="max-w-3xl">
              <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
              <p className="mt-4 text-xl opacity-75">{subtitle}</p>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6">
              {["Starter", "Growth", "Scale"].map((tier, index) => (
                <div key={tier} className="relative rounded-2xl p-7" style={{ background: index === 1 ? cfg.accent : cfg.soft, color: index === 1 ? "#fff" : cfg.fg }}>
                  <div className="text-sm font-bold uppercase opacity-70">{tier}</div>
                  <div className="mt-5 text-5xl font-black">{["$499", "$1.5k", "$4k"][index]}</div>
                  {items.slice(0, 3).map((item) => (
                    <div key={item.label} className="mt-5 border-t pt-4 text-sm leading-relaxed opacity-85" style={{ borderColor: index === 1 ? "rgba(255,255,255,.25)" : "rgba(15,23,42,.12)" }}>
                      {item.label}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "risk":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.8fr_1.2fr] gap-10 p-16">
            <div className="flex flex-col justify-center">
              <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
              <p className="mt-5 text-xl opacity-75">{subtitle}</p>
            </div>
            <div className="grid grid-cols-4 grid-rows-4 gap-3">
              {Array.from({ length: 16 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-end rounded-lg p-4 text-sm font-bold"
                  style={{
                    background: index % 5 === 0 ? cfg.accent : index % 3 === 0 ? cfg.soft : "rgba(255,255,255,.5)",
                    color: index % 5 === 0 ? "#fff" : cfg.fg,
                    opacity: 0.72 + (index % 4) * 0.07,
                  }}
                >
                  R{index + 1}
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "featureGrid":
      return (
        <Shell cfg={cfg}>
          <div className="flex h-full w-full flex-col p-14">
            <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
            <p className="mt-4 max-w-3xl text-xl opacity-75">{subtitle}</p>
            <div className="mt-10 grid grid-cols-3 gap-5">
              {items.concat(items).slice(0, 6).map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-2xl p-6" style={{ background: index % 2 ? cfg.soft : cfg.bg, border: `2px solid ${cfg.soft}` }}>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full text-lg font-black text-white" style={{ background: cfg.accent }}>
                    {index + 1}
                  </div>
                  <h3 className="text-xl font-black">{item.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed opacity-75">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "agenda":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.75fr_1.25fr] gap-12 p-16">
            <div className="flex flex-col justify-center">
              <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
              <p className="mt-5 text-xl opacity-75">{subtitle}</p>
            </div>
            <div className="flex flex-col justify-center gap-4">
              {items.concat(items).slice(0, 6).map((item, index) => (
                <div key={`${item.label}-${index}`} className="grid grid-cols-[80px_1fr] items-center rounded-2xl p-4" style={{ background: index % 2 ? cfg.soft : "rgba(255,255,255,.62)" }}>
                  <div className="text-4xl font-black" style={{ color: cfg.accent }}>{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <h3 className="text-xl font-black">{item.label}</h3>
                    <p className="text-sm opacity-70">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "caseStudy":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[1fr_1fr] gap-10 p-16">
            <div className="flex flex-col justify-between">
              <div>
                <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
                <p className="mt-5 text-xl opacity-75">{subtitle}</p>
              </div>
              <img src={data.imageUrl} alt="" className="h-64 rounded-[36px] object-cover" />
            </div>
            <div className="grid grid-cols-2 gap-5">
              {metrics.slice(0, 4).map((metric, index) => (
                <div key={metric.label} className="rounded-2xl p-6" style={{ background: index === 0 ? cfg.accent : cfg.soft, color: index === 0 ? "#fff" : cfg.fg }}>
                  <div className="text-sm font-bold opacity-70">{metric.label}</div>
                  <div className="mt-3 text-5xl font-black">{metric.value}</div>
                  <p className="mt-4 text-sm leading-relaxed opacity-80">{metric.note}</p>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "quote":
    case "thankYou":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.8fr_1.2fr] gap-10 p-16">
            <img src={data.imageUrl} alt="" className="h-full w-full rounded-full object-cover" />
            <div className="flex flex-col justify-center">
              <div className="text-8xl font-black" style={{ color: cfg.accent }}>&ldquo;</div>
              <h1 className="max-w-4xl text-5xl font-black leading-tight" style={textStyle}>{data.quote || title}</h1>
              <p className="mt-8 max-w-2xl text-xl opacity-75">{subtitle}</p>
            </div>
          </div>
        </Shell>
      );
    case "team":
    case "portfolio":
      return (
        <Shell cfg={cfg}>
          <div className="flex h-full w-full flex-col p-14">
            <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
            <div className="mt-10 grid grid-cols-4 gap-5">
              {items.slice(0, 4).map((item, index) => (
                <div key={item.label} className="overflow-hidden rounded-xl" style={{ background: cfg.soft }}>
                  <img
                    src={`${data.imageUrl}?tile=${index}`}
                    alt=""
                    className="h-36 w-full object-cover"
                    style={{ filter: index % 2 ? "saturate(1.3)" : "contrast(1.08)" }}
                  />
                  <div className="p-5">
                  <h3 className="mt-5 text-xl font-bold">{item.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed opacity-75">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "swot":
    case "matrix":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.75fr_1.25fr] gap-10 p-16">
            <div className="flex flex-col justify-center">
              <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
              <p className="mt-5 text-xl opacity-75">{subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {["Strengths", "Risks", "Opportunities", "Actions"].map((heading, index) => (
                <div key={heading} className="rounded-xl p-6" style={{ background: cfg.soft }}>
                  <h3 className="text-2xl font-black" style={{ color: cfg.accent }}>{heading}</h3>
                  <p className="mt-4 text-sm leading-relaxed opacity-75">{items[index % items.length]?.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "pyramid":
    case "funnel":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.9fr_1.1fr] gap-10 p-16">
            <div className="flex flex-col justify-center">
              <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
              <p className="mt-5 text-xl opacity-75">{subtitle}</p>
            </div>
            <div className="flex flex-col justify-center gap-4">
              {items.slice(0, 4).map((item, index) => (
                <div key={item.label} className="mx-auto rounded-lg px-8 py-5 text-center text-white" style={{ width: `${95 - index * 15}%`, background: index === 0 ? cfg.accent : cfg.soft, color: index === 0 ? "#fff" : cfg.fg }}>
                  <div className="text-xl font-black">{item.label}</div>
                  <div className="text-sm opacity-80">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
    case "map":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.85fr_1.15fr] gap-10 p-16">
            <div className="flex flex-col justify-center">
              <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
              <p className="mt-5 text-xl opacity-75">{subtitle}</p>
            </div>
            <div className="relative rounded-[36px] p-8" style={{ background: cfg.soft }}>
              <svg className="h-full w-full" viewBox="0 0 560 420">
                <path d="M80 250 C120 110 260 120 310 70 C390 -5 510 80 480 190 C455 285 350 260 300 340 C245 420 110 390 80 250Z" fill={cfg.bg} stroke={cfg.accent} strokeWidth="5" />
                {[120, 210, 310, 420].map((x, i) => <circle key={x} cx={x} cy={[230, 160, 280, 180][i]} r="18" fill={cfg.accent} />)}
              </svg>
            </div>
          </div>
        </Shell>
      );
    default:
      return (
        <Shell cfg={cfg}>
          <div className="flex h-full w-full flex-col p-16">
            <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
            <p className="mt-5 text-xl opacity-75">{subtitle}</p>
            <div className="mt-10 grid grid-cols-4 gap-5">
              {items.slice(0, 4).map((item) => (
                <div key={item.label} className="rounded-xl p-6" style={{ background: cfg.soft }}>
                  <h3 className="text-xl font-bold">{item.label}</h3>
                  <p className="mt-3 text-sm leading-relaxed opacity-75">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Shell>
      );
  }
}

function createMegaComponent(cfg: MegaConfig, Schema: ReturnType<typeof makeSchema>) {
  const MegaLayout: React.FC<{ data: Partial<z.infer<typeof Schema>> }> = ({ data }) => {
    const parsed = Schema.parse(data || {});
    return renderLayout(cfg, parsed);
  };
  return MegaLayout;
}

const kinds: MegaKind[] = [
  "hero", "split", "metrics", "timeline", "comparison", "process", "quote", "team", "table", "chart",
  "roadmap", "swot", "pyramid", "funnel", "matrix", "agenda", "caseStudy", "pricing", "risk", "dashboard",
  "map", "featureGrid", "beforeAfter", "thankYou", "portfolio",
];

const styles = [
  { suffix: "Aurora", accent: "#2563eb", bg: "#ffffff", fg: "#0f172a", soft: "#dbeafe" },
  { suffix: "Ember", accent: "#dc2626", bg: "#fff7ed", fg: "#111827", soft: "#fed7aa" },
  { suffix: "Mint", accent: "#059669", bg: "#f8fafc", fg: "#0f172a", soft: "#d1fae5" },
  { suffix: "Ink", accent: "#7c3aed", bg: "#111827", fg: "#f9fafb", soft: "#312e81" },
];

const kindLabels: Record<MegaKind, string> = {
  hero: "Hero Statement",
  split: "Split Narrative",
  metrics: "Metrics Board",
  timeline: "Timeline",
  comparison: "Comparison",
  process: "Process Flow",
  quote: "Quote Focus",
  team: "Team Cards",
  table: "Table Summary",
  chart: "Chart Insight",
  roadmap: "Roadmap",
  swot: "SWOT Matrix",
  pyramid: "Pyramid",
  funnel: "Funnel",
  matrix: "Decision Matrix",
  agenda: "Agenda",
  caseStudy: "Case Study",
  pricing: "Pricing",
  risk: "Risk Register",
  dashboard: "Dashboard",
  map: "Market Map",
  featureGrid: "Feature Grid",
  beforeAfter: "Before After",
  thankYou: "Thank You",
  portfolio: "Portfolio",
};

const categoryKindMap: Record<string, MegaKind> = {
  Investor: "hero",
  Sales: "pricing",
  Proposal: "caseStudy",
  Food: "portfolio",
  Ecommerce: "featureGrid",
  "Real Estate": "portfolio",
  Health: "metrics",
  Education: "timeline",
  Fashion: "portfolio",
  Beauty: "split",
  Consulting: "matrix",
  Nonprofit: "quote",
  Events: "roadmap",
  Healthcare: "metrics",
  Finance: "dashboard",
  AI: "process",
  Security: "risk",
  HR: "team",
  Travel: "map",
  Design: "portfolio",
  Architecture: "portfolio",
  Technology: "dashboard",
  Marketing: "funnel",
  Branding: "hero",
  Creative: "portfolio",
  Media: "table",
  Creator: "featureGrid",
  Coaching: "process",
  Legal: "table",
  Operations: "process",
  Manufacturing: "metrics",
  Construction: "timeline",
  Energy: "pyramid",
  "Local Service": "comparison",
  Mobility: "roadmap",
  Hospitality: "portfolio",
  Startup: "hero",
  Training: "agenda",
  Data: "dashboard",
  Research: "swot",
  Strategy: "matrix",
  Executive: "dashboard",
  Corporate: "table",
  Community: "team",
  Web3: "beforeAfter",
  Gaming: "chart",
  Entertainment: "portfolio",
  Publishing: "timeline",
  Speaking: "hero",
  Career: "portfolio",
  Government: "roadmap",
  Culture: "portfolio",
  Sports: "metrics",
  Business: "funnel",
};

const configs: MegaConfig[] = onlinePresentationServiceDecks.map((deck, index) => {
  const style = styles[index % styles.length];
  const fallbackKind = kinds[index % kinds.length];
  return {
    id: `mega-${String(index + 1).padStart(3, "0")}-${deck.id}`,
    name: deck.title,
    description: `${deck.category} presentation template for ${deck.audience}. ${deck.summary}`,
    kind: categoryKindMap[deck.category] || fallbackKind,
    accent: deck.accent || style.accent,
    bg: style.bg,
    fg: style.fg,
    soft: style.soft,
    imageUrl: `https://picsum.photos/seed/${deck.id}/900/700`,
    curve: index,
  };
});

type PagePlan = { suffix: string; name: string; kind: MegaKind; description: string };

const pagePlanPresets: PagePlan[][] = [
  [
    { suffix: "cover", name: "Cover", kind: "hero", description: "Opening title slide with a strong visual promise." },
    { suffix: "funnel", name: "Funnel", kind: "funnel", description: "Conversion or decision funnel slide." },
    { suffix: "pricing", name: "Pricing", kind: "pricing", description: "Offer and package comparison slide." },
    { suffix: "proof", name: "Proof", kind: "chart", description: "Chart-backed proof and momentum slide." },
    { suffix: "case", name: "Case Study", kind: "caseStudy", description: "Customer result or transformation proof slide." },
    { suffix: "process", name: "Process", kind: "timeline", description: "Step-by-step process or delivery timeline slide." },
    { suffix: "closing", name: "Closing", kind: "thankYou", description: "Final call-to-action and closing statement slide." },
  ],
  [
    { suffix: "visual", name: "Visual Lead", kind: "split", description: "Image-led value proposition slide." },
    { suffix: "market", name: "Market Map", kind: "map", description: "Market, audience, or territory mapping slide." },
    { suffix: "metrics", name: "Metrics", kind: "metrics", description: "Key numbers and performance proof slide." },
    { suffix: "roadmap", name: "Roadmap", kind: "roadmap", description: "Milestone and rollout slide." },
    { suffix: "matrix", name: "Decision Matrix", kind: "matrix", description: "Prioritization and tradeoff slide." },
    { suffix: "team", name: "Team", kind: "team", description: "People, roles, or partner capability slide." },
    { suffix: "quote", name: "Quote", kind: "quote", description: "Bold testimonial or belief slide." },
  ],
  [
    { suffix: "portfolio", name: "Portfolio", kind: "portfolio", description: "Gallery or work sample overview slide." },
    { suffix: "features", name: "Features", kind: "featureGrid", description: "Six-part feature or benefit grid slide." },
    { suffix: "before-after", name: "Before After", kind: "beforeAfter", description: "Current state versus future state slide." },
    { suffix: "agenda", name: "Agenda", kind: "agenda", description: "Meeting, workshop, or lesson agenda slide." },
    { suffix: "table", name: "Table", kind: "table", description: "Structured facts and comparison table slide." },
    { suffix: "dashboard", name: "Dashboard", kind: "dashboard", description: "Business dashboard and signal slide." },
    { suffix: "closing", name: "Closing", kind: "thankYou", description: "Final call-to-action and closing statement slide." },
  ],
  [
    { suffix: "dark-cover", name: "Dark Cover", kind: "hero", description: "High contrast opening statement slide." },
    { suffix: "risk", name: "Risk Map", kind: "risk", description: "Risk heatmap and mitigation slide." },
    { suffix: "swot", name: "SWOT", kind: "swot", description: "Strategy matrix slide." },
    { suffix: "pyramid", name: "Pyramid", kind: "pyramid", description: "Hierarchy or maturity model slide." },
    { suffix: "process", name: "Process", kind: "process", description: "Operational workflow slide." },
    { suffix: "comparison", name: "Comparison", kind: "comparison", description: "Two-column alternative comparison slide." },
    { suffix: "thank-you", name: "Thank You", kind: "thankYou", description: "Closing statement slide." },
  ],
  [
    { suffix: "gallery", name: "Gallery Cover", kind: "portfolio", description: "Visual gallery introduction slide." },
    { suffix: "case", name: "Case Study", kind: "caseStudy", description: "Outcome and evidence slide." },
    { suffix: "timeline", name: "Timeline", kind: "timeline", description: "Chronological story slide." },
    { suffix: "pricing", name: "Packages", kind: "pricing", description: "Commercial package slide." },
    { suffix: "map", name: "Expansion Map", kind: "map", description: "Expansion or service area slide." },
    { suffix: "quote", name: "Voice", kind: "quote", description: "Brand voice or testimonial slide." },
    { suffix: "final", name: "Final", kind: "thankYou", description: "Final call-to-action slide." },
  ],
  [
    { suffix: "agenda", name: "Agenda Cover", kind: "agenda", description: "Structured session opening slide." },
    { suffix: "chart", name: "Insight Chart", kind: "chart", description: "Analytical trend slide." },
    { suffix: "table", name: "Details Table", kind: "table", description: "Operational data table slide." },
    { suffix: "risk", name: "Risk Register", kind: "risk", description: "Issue tracking heatmap slide." },
    { suffix: "feature-grid", name: "Feature Grid", kind: "featureGrid", description: "Capability grid slide." },
    { suffix: "roadmap", name: "Roadmap", kind: "roadmap", description: "Next steps and milestones slide." },
    { suffix: "closing", name: "Closing", kind: "thankYou", description: "Closing statement slide." },
  ],
];

const getPagePlans = (index: number) => pagePlanPresets[index % pagePlanPresets.length];

const createMegaTemplate = (
  cfg: MegaConfig,
  page: PagePlan,
  pageIndex: number,
  groupIndex: number
) => {
  const pageConfig: MegaConfig = {
    ...cfg,
    id: `${cfg.id}-${page.suffix}`,
    name: `${cfg.name} ${page.name}`,
    description: `${cfg.name} ${page.name.toLowerCase()} page. ${page.description}`,
    kind: page.kind,
    curve: cfg.curve + pageIndex,
  };
  const Schema = makeSchema(pageConfig.name, pageConfig.imageUrl);
  const groupId = `mega-${String(groupIndex + 1).padStart(3, "0")}`;
  return createTemplateEntry(
    createMegaComponent(pageConfig, Schema),
    Schema,
    pageConfig.id,
    pageConfig.name,
    pageConfig.description,
    groupId,
    `${pageIndex + 1}-${page.suffix}`
  );
};

export const megaTemplateGroups: TemplateLayoutsWithSettings[] = configs.map((cfg, index) => {
  const pagePlans = getPagePlans(index);
  return {
    id: `mega-${String(index + 1).padStart(3, "0")}`,
    name: cfg.name,
    description: `${cfg.description} Includes ${pagePlans.length} ready-made pages.`,
    settings: {
      description: `${cfg.description} Includes ${pagePlans.length} ready-made pages.`,
      ordered: true,
      default: false,
    },
    layouts: pagePlans.map((page, pageIndex) => createMegaTemplate(cfg, page, pageIndex, index)),
  };
});

export const megaTemplates: TemplateWithData[] = megaTemplateGroups.flatMap((group) => group.layouts);
