import React from "react";
import * as z from "zod";
import { onlinePresentationServiceDecks } from "../../presentation-decks/onlinePresentationServiceDecks";
import { createTemplateEntry, TemplateLayoutsWithSettings, TemplateWithData } from "../utils";

type MegaKind =
  | "redEditorial"
  | "visionMission"
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
  | "pieChart"
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

function makeSchema(title: string, imageUrl: string, subtitle: string, quote: string) {
  return z.object({
    title: z.string().max(120).default(title),
    subtitle: z.string().max(220).default(subtitle),
    quote: z.string().max(220).default(quote),
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
    className="relative mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] overflow-hidden rounded-xl border shadow-2xl"
    style={{
      background: `radial-gradient(circle at ${cfg.curve % 2 ? "86% 12%" : "12% 86%"}, ${cfg.soft} 0, transparent 34%), ${cfg.bg}`,
      borderColor: cfg.soft,
      color: cfg.fg,
      fontFamily: "Inter, Arial, sans-serif",
    }}
  >
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-80" viewBox="0 0 1280 720" preserveAspectRatio="none">
      {cfg.curve % 4 === 0 && <path d="M0 560 C220 450 360 690 610 555 C830 435 970 545 1280 410 L1280 720 L0 720 Z" fill={cfg.soft} />}
      {cfg.curve % 4 === 1 && <path d="M780 0 C900 140 1120 70 1280 210 L1280 0 Z" fill={cfg.soft} />}
      {cfg.curve % 4 === 2 && <path d="M0 0 C210 110 270 270 145 455 C90 535 45 625 0 720 Z" fill={cfg.soft} />}
      {cfg.curve % 4 === 3 && <path d="M360 720 C490 520 780 670 940 420 C1040 260 1160 220 1280 240 L1280 720 Z" fill={cfg.soft} />}
      <circle cx={cfg.curve % 2 ? 1060 : 180} cy={cfg.curve % 3 ? 140 : 560} r="86" fill={cfg.accent} opacity="0.12" />
    </svg>
    <div className="absolute right-8 top-8 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur" style={{ background: `${cfg.soft}cc`, borderColor: cfg.soft, color: cfg.fg }}>
      {cfg.name}
    </div>
    {children}
  </div>
);

const MetricCard = ({ metric, cfg }: { metric: { label: string; value: string; note: string }; cfg: MegaConfig }) => (
  <div className="rounded-2xl border p-5 shadow-sm backdrop-blur" style={{ background: `${cfg.soft}dd`, borderColor: cfg.soft }}>
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

const MiniPie = ({ cfg }: { cfg: MegaConfig }) => {
  const darkSlice = cfg.fg === "#f9fafb" ? "#f8fafc" : "#0f172a";
  return (
    <div className="relative mx-auto flex h-72 w-72 items-center justify-center rounded-full" style={{ background: `conic-gradient(${cfg.accent} 0 42%, ${cfg.soft} 42% 68%, ${darkSlice} 68% 84%, rgba(255,255,255,.72) 84% 100%)` }}>
      <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full text-center shadow-sm" style={{ background: cfg.bg, color: cfg.fg }}>
        <span className="text-4xl font-black">42%</span>
        <span className="text-xs font-bold uppercase opacity-65">Primary</span>
      </div>
    </div>
  );
};

function renderLayout(cfg: MegaConfig, data: z.infer<ReturnType<typeof makeSchema>>) {
  const title = data.title;
  const subtitle = data.subtitle;
  const items = data.items?.length ? data.items : baseItems;
  const metrics = data.metrics?.length ? data.metrics : baseMetrics;
  const rows = data.rows?.length ? data.rows : baseRows;

  switch (cfg.kind) {
    case "redEditorial": {
      const red = "#f51f18";
      const cream = "#fbf8f1";
      const black = "#050505";
      const page = cfg.id.split("-").pop() || "cover";
      const imageFor = (seed: string, width = 1200, height = 900) => `https://picsum.photos/seed/red-editorial-${seed}/${width}/${height}`;
      const redImageStyle = { filter: "saturate(1.18) contrast(1.08)" };
      const Arrow = ({ className = "" }: { className?: string }) => (
        <svg className={className} width="92" height="92" viewBox="0 0 92 92" fill="none">
          <path d="M16 18H74V76" stroke="currentColor" strokeWidth="10" />
          <path d="M74 18L18 74" stroke="currentColor" strokeWidth="10" />
        </svg>
      );
      const Rule = () => <div className="h-[3px] w-full" style={{ background: "#b8b8b8" }} />;

      if (page === "audience") {
        const audienceRows = [
          ["(AGE)", "FROM YOUNG STUDENT TO MORE\nSEASONED PROFESSIONALS"],
          ["(CLIENT)", "MEDIUM TO HIGH PEOPLE,\nMARKETING AGENCIES, MODELS"],
          ["(LOCATION)", "CLEAN MODERN, GLOBAL SITE,\nLOW MAINTENANCE"],
        ];
        return (
          <div className="mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] flex-col overflow-hidden px-10 py-9" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <h1 className="text-[150px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.04em" }}>Target Audience</h1>
            <div className="mt-28 flex flex-1 flex-col justify-between">
              {audienceRows.map(([label, value]) => (
                <div key={label}>
                  <Rule />
                  <div className="grid grid-cols-[1fr_0.9fr] py-8">
                    <div className="text-2xl font-black" style={{ color: red }}>{label}</div>
                    <div className="whitespace-pre-line text-2xl font-medium leading-tight">{value}</div>
                  </div>
                </div>
              ))}
              <Rule />
            </div>
          </div>
        );
      }

      if (page === "positioning") {
        const brandRows = [
          ["Target Audience Focus", "Aligning the brand with the needs, expectations,\nand preferences of its intended audience"],
          ["Distinct Identity", "Establishing a unique position that differentiates\nthe brand from competitors in the market"],
          ["Competitive Advantage", "Highlighting the brand's unique qualities to\nstrengthen its presence within the industry"],
          ["Market Relevance", "Ensuring the brand remains meaningful,\nrecognizable, and competitive in a dynamic market"],
        ];
        return (
          <div className="mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] flex-col overflow-hidden px-10 py-9" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <h1 className="text-[150px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.04em" }}>Brand Positioning</h1>
            <div className="mt-20 flex flex-1 flex-col justify-between">
              {brandRows.map(([label, value]) => (
                <div key={label}>
                  <Rule />
                  <div className="grid grid-cols-[1.35fr_1fr] py-7">
                    <div className="text-2xl font-black uppercase" style={{ color: red }}>{label}</div>
                    <div className="whitespace-pre-line text-2xl font-medium leading-tight">{value}</div>
                  </div>
                </div>
              ))}
              <Rule />
            </div>
          </div>
        );
      }

      if (page === "timeline") {
        const phases = [
          ["Phase 1", "Strategy & Direction", "Initial planning and\ncreative alignment"],
          ["Phase 2", "Concept Development", "Draft visuals, exploration\nand references"],
          ["Phase 3", "Production & Refinement", "Final asset creation\nand revisions"],
          ["Phase 4", "Product Delivery", "Export, approval, and\nimplementation"],
        ];
        return (
          <div className="mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] flex-col overflow-hidden px-10 py-9" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <h1 className="text-[150px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.04em" }}>Project Timeline</h1>
            <div className="mt-28 flex flex-1 flex-col justify-between">
              {phases.map(([phase, name, detail]) => (
                <div key={phase}>
                  <Rule />
                  <div className="grid grid-cols-[130px_150px_1fr_0.55fr] items-center py-5">
                    <div className="text-2xl font-black uppercase">{phase}</div>
                    <div className="h-[3px] bg-black" />
                    <div className="pl-8 text-2xl font-black uppercase" style={{ color: red }}>{name}</div>
                    <div className="whitespace-pre-line text-xl leading-tight">{detail}</div>
                  </div>
                </div>
              ))}
              <Rule />
            </div>
          </div>
        );
      }

      if (page === "campaign") {
        const links = ["The Campaign", "Target Audience", "Social Media", "Deliverables", "Visual Style"];
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.62fr_1fr] gap-14 overflow-hidden px-10 py-10" style={{ background: cream, color: red, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <img src={imageFor("campaign-reader", 720, 980)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
            <div className="flex flex-col justify-between">
              {links.map((label, index) => (
                <div key={label}>
                  <div className="grid grid-cols-[60px_1fr_82px] items-center gap-6">
                    <div className="text-xl font-medium">({String(index + 1).padStart(2, "0")})</div>
                    <div className="text-[72px] font-black uppercase leading-none" style={{ letterSpacing: "-0.04em" }}>{label}</div>
                    <Arrow className="text-red-600" />
                  </div>
                  <div className="mt-6 h-[3px]" style={{ background: red }} />
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (page === "thanks") {
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[1fr_0.82fr] overflow-hidden p-10 text-white" style={{ background: red, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <div className="flex flex-col justify-between">
              <h1 className="text-[150px] font-black uppercase leading-none" style={{ letterSpacing: "-0.05em" }}>Thank You</h1>
              <div className="space-y-10 text-[26px] uppercase">
                <div><div>Phone Number:</div><strong>+123-456-7890</strong></div>
                <div><div>Email Address:</div><strong>HELLO@REALLYGREATSITE.COM</strong></div>
                <div><div>Website:</div><strong>REALLYGREATSITE.COM</strong></div>
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <Arrow className="ml-auto text-white" />
              <img src={imageFor("thanks-studio", 780, 320)} alt="" className="h-[270px] w-full object-cover" style={redImageStyle} />
            </div>
          </div>
        );
      }

      if (page === "brief") {
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.92fr_1fr] overflow-hidden" style={{ background: cream, color: red, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <div className="flex flex-col justify-between p-10" style={{ background: red, color: cream }}>
              <h1 className="text-[128px] font-black uppercase leading-[0.9]" style={{ letterSpacing: "-0.05em" }}>Creative<br />Brief</h1>
              <Arrow className="mx-auto text-white" />
              <div className="grid grid-cols-2 text-2xl uppercase">
                <strong>Shodwe Studio</strong>
                <strong>@ReallyGreatSite</strong>
              </div>
            </div>
            <img src={imageFor("creative-brief-team", 920, 720)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
          </div>
        );
      }

      if (page === "strategy") {
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.85fr_1fr] overflow-hidden" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <img src={imageFor("brand-strategy-workshop", 780, 720)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
            <div className="flex flex-col justify-between p-16">
              <h1 className="text-[110px] font-black uppercase leading-[0.92]" style={{ color: red, letterSpacing: "-0.05em" }}>Brand<br />Strategy</h1>
              <p className="max-w-[580px] text-2xl leading-tight">The brand strategy defines the core direction of the brand. By understanding the market and brand goals</p>
              <div>
                <strong className="text-xl uppercase">(Key Focus)</strong>
                <div className="mt-6 space-y-3 text-3xl uppercase">
                  <div>Audience Insights</div>
                  <div>Brand Objectives</div>
                  <div>Market Understanding</div>
                </div>
              </div>
              <Arrow className="ml-auto text-red-600" />
            </div>
          </div>
        );
      }

      if (page === "style") {
        return (
          <div className="mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] flex-col overflow-hidden px-10 py-10" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <div className="grid grid-cols-[1fr_0.32fr]">
              <h1 className="text-[130px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.05em" }}>Visual Style</h1>
              <p className="pt-8 text-2xl leading-tight">The visual style establishes the brand's aesthetic direction, ensuring every design element to create a consistent visual</p>
            </div>
            <div className="mt-16 grid flex-1 grid-cols-[1fr_0.46fr] gap-10">
              <img src={imageFor("visual-style-main", 920, 560)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
              <div className="grid grid-rows-2 gap-10">
                <img src={imageFor("visual-style-a", 520, 250)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
                <img src={imageFor("visual-style-b", 520, 250)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
              </div>
            </div>
          </div>
        );
      }

      if (page === "summary") {
        return (
          <div className="mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] flex-col overflow-hidden px-10 py-10" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <div className="grid grid-cols-[1fr_0.38fr]">
              <h1 className="text-[132px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.05em" }}>Summarize</h1>
              <p className="pt-10 text-2xl leading-tight">The final result delivers a refined visual identity that enhances brand recognition while maintaining clarity, consistency, and strong visual communication</p>
            </div>
            <div className="relative mt-12 flex-1">
              <img src={imageFor("summary-reader", 1180, 460)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
              <div className="absolute bottom-5 left-6 rounded-full px-8 py-4 text-2xl uppercase text-white" style={{ background: red }}>Inspire meaningful brand connections</div>
              <div className="absolute bottom-5 right-8 rounded-full px-8 py-4 text-2xl uppercase text-white" style={{ background: red }}>Deliver memorable visual stories</div>
            </div>
          </div>
        );
      }

      return (
        <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[1fr_0.95fr] overflow-hidden" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
          <div className="relative p-10">
            <h1 className="text-[122px] font-black uppercase leading-[0.88]" style={{ color: red, letterSpacing: "-0.055em" }}>Brand<br />Messages</h1>
            <div className="absolute bottom-24 left-10 max-w-[500px]">
              <h2 className="text-3xl font-black uppercase" style={{ color: red }}>Design for Style & Performance</h2>
              <p className="mt-4 text-2xl leading-tight">A perfect balance of style and performance designed to stand out and built to deliver</p>
            </div>
            <div className="absolute bottom-10 left-10 max-w-[520px]">
              <h2 className="text-3xl font-black uppercase" style={{ color: red }}>Communicating the Brand's Vision</h2>
            </div>
          </div>
          <img src={imageFor("brand-messages-red", 760, 720)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
        </div>
      );
    }
    case "visionMission":
      return (
        <div className="relative mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[72px_1fr_450px] overflow-hidden bg-white shadow-2xl" style={{ fontFamily: "Inter, Arial, sans-serif" }}>
          <div className="h-full" style={{ background: "#bfff00" }} />
          <div className="flex flex-col justify-center px-12 py-14 text-black">
            <div className="mb-14 inline-flex w-fit rounded-full px-8 py-3 text-4xl font-black" style={{ background: "#bfff00", color: "#5b3ff2", letterSpacing: 0 }}>
              MSGR
            </div>
            <h1 className="max-w-[700px] text-[88px] font-black leading-[0.98]" style={{ letterSpacing: "-0.01em" }}>
              Vision and<br />Mission
            </h1>
            <p className="mt-10 max-w-[620px] text-[24px] font-semibold uppercase leading-snug tracking-[0.16em]">
              What we want to be and what it takes to achieve our goals
            </p>
            <p className="mt-14 text-[21px] font-medium">Presented by Daniel Gallego</p>
          </div>
          <div className="relative flex items-center justify-center p-8" style={{ background: "#5638f5" }}>
            <img src={data.imageUrl} alt="" className="h-[86%] w-full object-cover shadow-xl" />
            <div className="absolute bottom-14 right-0 flex h-24 w-44 items-center justify-center rounded-l-full" style={{ background: "#bfff00" }}>
              <svg width="92" height="42" viewBox="0 0 92 42" fill="none">
                <path d="M8 21H76" stroke="#5638f5" strokeWidth="7" strokeLinecap="round" />
                <path d="M58 7L78 21L58 35" stroke="#5638f5" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      );
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
            </div>
          </div>
        </Shell>
      );
    case "pieChart":
      return (
        <Shell cfg={cfg}>
          <div className="grid h-full w-full grid-cols-[0.85fr_1.15fr] gap-10 p-16">
            <div className="flex flex-col justify-center">
              <h1 className="text-5xl font-black" style={textStyle}>{title}</h1>
              <p className="mt-5 text-xl leading-relaxed opacity-75">{subtitle}</p>
              <div className="mt-10 grid grid-cols-2 gap-4">
                {rows.slice(0, 4).map((row, index) => (
                  <div key={row.label} className="rounded-xl p-4" style={{ background: index % 2 ? cfg.soft : "rgba(255,255,255,.52)" }}>
                    <div className="text-sm font-bold opacity-65">{row.label}</div>
                    <div className="mt-2 text-2xl font-black">{["42%", "26%", "16%", "16%"][index]}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-[36px] p-10" style={{ background: cfg.soft }}>
              <MiniPie cfg={cfg} />
              <div className="mt-8 grid grid-cols-4 gap-3 text-center text-xs font-bold">
                {["Core", "Upsell", "Retain", "New"].map((label, index) => (
                  <div key={label} className="rounded-full px-3 py-2" style={{ background: index === 0 ? cfg.accent : cfg.bg, color: index === 0 ? "#fff" : cfg.fg }}>{label}</div>
                ))}
              </div>
            </div>
          </div>
        </Shell>
      );
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
  "redEditorial", "visionMission", "hero", "split", "metrics", "timeline", "comparison", "process", "quote", "team", "table", "chart",
  "pieChart", "roadmap", "swot", "pyramid", "funnel", "matrix", "agenda", "caseStudy", "pricing", "risk", "dashboard",
  "map", "featureGrid", "beforeAfter", "thankYou", "portfolio",
];

const styles = [
  { suffix: "Aurora", accent: "#2563eb", bg: "#ffffff", fg: "#0f172a", soft: "#dbeafe" },
  { suffix: "Ember", accent: "#dc2626", bg: "#fff7ed", fg: "#111827", soft: "#fed7aa" },
  { suffix: "Mint", accent: "#059669", bg: "#f8fafc", fg: "#0f172a", soft: "#d1fae5" },
  { suffix: "Ink", accent: "#7c3aed", bg: "#111827", fg: "#f9fafb", soft: "#312e81" },
  { suffix: "Citrus", accent: "#ca8a04", bg: "#fefce8", fg: "#1f2937", soft: "#fde68a" },
  { suffix: "Coral", accent: "#f97316", bg: "#fff7ed", fg: "#1e293b", soft: "#ffedd5" },
  { suffix: "Rose", accent: "#e11d48", bg: "#fff1f2", fg: "#111827", soft: "#fecdd3" },
  { suffix: "Berry", accent: "#c026d3", bg: "#fdf4ff", fg: "#18181b", soft: "#f5d0fe" },
  { suffix: "Ocean", accent: "#0891b2", bg: "#ecfeff", fg: "#0f172a", soft: "#a5f3fc" },
  { suffix: "Teal", accent: "#0f766e", bg: "#f0fdfa", fg: "#102a2a", soft: "#99f6e4" },
  { suffix: "Lime", accent: "#65a30d", bg: "#f7fee7", fg: "#172554", soft: "#d9f99d" },
  { suffix: "Sky", accent: "#0284c7", bg: "#f0f9ff", fg: "#082f49", soft: "#bae6fd" },
  { suffix: "Violet", accent: "#6d28d9", bg: "#f5f3ff", fg: "#111827", soft: "#ddd6fe" },
  { suffix: "Graphite", accent: "#14b8a6", bg: "#0f172a", fg: "#f8fafc", soft: "#164e63" },
  { suffix: "Midnight", accent: "#f59e0b", bg: "#111827", fg: "#f9fafb", soft: "#374151" },
  { suffix: "Wine", accent: "#be123c", bg: "#1f1020", fg: "#fff7ed", soft: "#4c1d33" },
  { suffix: "Forest", accent: "#22c55e", bg: "#052e16", fg: "#f0fdf4", soft: "#14532d" },
  { suffix: "Electric", accent: "#38bdf8", bg: "#0c1222", fg: "#f8fafc", soft: "#1e3a8a" },
  { suffix: "Slate", accent: "#64748b", bg: "#f8fafc", fg: "#0f172a", soft: "#e2e8f0" },
  { suffix: "Copper", accent: "#b45309", bg: "#fffbeb", fg: "#1c1917", soft: "#fed7aa" },
  { suffix: "Aqua", accent: "#06b6d4", bg: "#ffffff", fg: "#111827", soft: "#cffafe" },
  { suffix: "Punch", accent: "#db2777", bg: "#fdf2f8", fg: "#111827", soft: "#fbcfe8" },
  { suffix: "Indigo", accent: "#4f46e5", bg: "#eef2ff", fg: "#111827", soft: "#c7d2fe" },
  { suffix: "Moss", accent: "#15803d", bg: "#fafaf9", fg: "#1c1917", soft: "#bbf7d0" },
  { suffix: "RubyDark", accent: "#fb7185", bg: "#18181b", fg: "#fafafa", soft: "#3f1d2b" },
  { suffix: "BlueDark", accent: "#60a5fa", bg: "#0b1120", fg: "#f8fafc", soft: "#1e293b" },
  { suffix: "Pearl", accent: "#0ea5e9", bg: "#f8fafc", fg: "#0f172a", soft: "#e0f2fe" },
  { suffix: "Sandstone", accent: "#d97706", bg: "#fffaf0", fg: "#292524", soft: "#fde68a" },
  { suffix: "Lavender", accent: "#8b5cf6", bg: "#faf5ff", fg: "#1f2937", soft: "#e9d5ff" },
  { suffix: "Flamingo", accent: "#f43f5e", bg: "#fff5f7", fg: "#172033", soft: "#ffe4e6" },
  { suffix: "Lagoon", accent: "#0891b2", bg: "#f0fdfa", fg: "#164e63", soft: "#ccfbf1" },
  { suffix: "Pistachio", accent: "#84cc16", bg: "#fcfff4", fg: "#1f2937", soft: "#ecfccb" },
  { suffix: "Royal", accent: "#4338ca", bg: "#f8fafc", fg: "#111827", soft: "#e0e7ff" },
  { suffix: "Signal", accent: "#ef4444", bg: "#ffffff", fg: "#111827", soft: "#fee2e2" },
  { suffix: "NeonDark", accent: "#a3e635", bg: "#09090b", fg: "#fafafa", soft: "#1a2e05" },
  { suffix: "CyanDark", accent: "#22d3ee", bg: "#082f49", fg: "#ecfeff", soft: "#155e75" },
  { suffix: "PlumDark", accent: "#d946ef", bg: "#1e102a", fg: "#faf5ff", soft: "#581c87" },
  { suffix: "AmberDark", accent: "#fbbf24", bg: "#1c1917", fg: "#fffbeb", soft: "#451a03" },
  { suffix: "GreenDark", accent: "#4ade80", bg: "#0b1f17", fg: "#f0fdf4", soft: "#166534" },
  { suffix: "PinkDark", accent: "#f472b6", bg: "#1f1020", fg: "#fdf2f8", soft: "#831843" },
  { suffix: "Steel", accent: "#475569", bg: "#f1f5f9", fg: "#0f172a", soft: "#cbd5e1" },
  { suffix: "Apricot", accent: "#ea580c", bg: "#fff7ed", fg: "#1c1917", soft: "#fed7aa" },
  { suffix: "Jade", accent: "#10b981", bg: "#f7fffb", fg: "#052e2b", soft: "#a7f3d0" },
  { suffix: "Cobalt", accent: "#1d4ed8", bg: "#eff6ff", fg: "#111827", soft: "#bfdbfe" },
  { suffix: "Orchid", accent: "#a21caf", bg: "#fdf4ff", fg: "#27272a", soft: "#f0abfc" },
  { suffix: "Sunrise", accent: "#f59e0b", bg: "#fff7ed", fg: "#111827", soft: "#fde68a" },
  { suffix: "Crimson", accent: "#b91c1c", bg: "#fff1f2", fg: "#1f2937", soft: "#fecaca" },
  { suffix: "Marine", accent: "#0369a1", bg: "#f0f9ff", fg: "#082f49", soft: "#bae6fd" },
  { suffix: "Olive", accent: "#4d7c0f", bg: "#fefce8", fg: "#1c1917", soft: "#d9f99d" },
  { suffix: "MonoPop", accent: "#111827", bg: "#ffffff", fg: "#111827", soft: "#e5e7eb" },
];

const kindLabels: Record<MegaKind, string> = {
  redEditorial: "Red Editorial",
  visionMission: "Vision Mission",
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
  pieChart: "Pie Chart",
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
  Gaming: "pieChart",
  Entertainment: "portfolio",
  Publishing: "timeline",
  Speaking: "hero",
  Career: "portfolio",
  Government: "roadmap",
  Culture: "portfolio",
  Sports: "metrics",
  Business: "funnel",
};

const makeConfig = (deck: (typeof onlinePresentationServiceDecks)[number], index: number, variant = 0): MegaConfig => {
  const style = styles[index % styles.length];
  const accent = index % 3 === 0 ? style.accent : deck.accent || style.accent;
  const fallbackKind = kinds[index % kinds.length];
  return {
    id: `mega-${String(index + 1).padStart(3, "0")}-${deck.id}`,
    name: deck.title,
    description: `${deck.category} presentation template for ${deck.audience}. ${deck.summary}`,
    kind: categoryKindMap[deck.category] || fallbackKind,
    accent,
    bg: style.bg,
    fg: style.fg,
    soft: style.soft,
    imageUrl: `https://picsum.photos/seed/${variant ? `${deck.id}-studio-${variant}` : deck.id}/900/700`,
    curve: index,
  };
};

const secondCollectionAngles = [
  "Studio Edition",
  "Editorial Edition",
  "Executive Edition",
  "Investor Remix",
  "Data Story Edition",
  "Bold Campaign Edition",
  "Minimal Pro Edition",
  "Premium Service Edition",
  "Launch System Edition",
  "Visual Strategy Edition",
];

const baseConfigs: MegaConfig[] = onlinePresentationServiceDecks.map((deck, index) => makeConfig(deck, index));

const expansionConfigs: MegaConfig[] = onlinePresentationServiceDecks.map((deck, index) => {
  const configIndex = index + onlinePresentationServiceDecks.length;
  const style = styles[(index * 7 + 11) % styles.length];
  const angle = secondCollectionAngles[index % secondCollectionAngles.length];
  const baseKind = kinds[(index * 5 + 3) % kinds.length];
  return {
    ...makeConfig(deck, configIndex, 2),
    name: `${deck.title} ${angle}`,
    description: `${deck.category} ${angle.toLowerCase()} for ${deck.audience}. A second-generation layout direction with different pacing, visuals, and slide structure.`,
    kind: baseKind,
    accent: index % 2 ? style.accent : deck.accent || style.accent,
    bg: style.bg,
    fg: style.fg,
    soft: style.soft,
    curve: configIndex * 2,
  };
});

const featuredRedEditorialConfig: MegaConfig = {
  id: "mega-featured-red-editorial",
  name: "Red Editorial Brand Campaign",
  description: "A bold cream and red editorial brand campaign deck with oversized condensed typography, table-style strategy pages, image-heavy creative sections, and strong arrow motifs.",
  kind: "redEditorial",
  accent: "#f51f18",
  bg: "#fbf8f1",
  fg: "#000000",
  soft: "#f3eee5",
  imageUrl: "https://picsum.photos/seed/red-editorial-brand-campaign/1200/900",
  curve: 0,
};

const featuredVisionConfig: MegaConfig = {
  id: "mega-featured-vision-mission",
  name: "MSGR Vision and Mission",
  description: "A bold neon and violet vision mission presentation inspired by modern youth culture, strong editorial typography, and image-led storytelling.",
  kind: "visionMission",
  accent: "#bfff00",
  bg: "#ffffff",
  fg: "#000000",
  soft: "#ede9fe",
  imageUrl: "https://picsum.photos/seed/msgr-vision-mission/900/1200",
  curve: 1,
};

const featuredConfigs: MegaConfig[] = [featuredRedEditorialConfig, featuredVisionConfig];

const configs: MegaConfig[] = [...featuredConfigs, ...baseConfigs, ...expansionConfigs];

type PagePlan = { suffix: string; name: string; kind: MegaKind; description: string };

const pagePlanPresets: PagePlan[][] = [
  [
    { suffix: "cover", name: "Cover", kind: "hero", description: "Opening title slide with a strong visual promise." },
    { suffix: "funnel", name: "Funnel", kind: "funnel", description: "Conversion or decision funnel slide." },
    { suffix: "pricing", name: "Pricing", kind: "pricing", description: "Offer and package comparison slide." },
    { suffix: "proof", name: "Proof", kind: "chart", description: "Bar and line chart proof slide with momentum signals." },
    { suffix: "case", name: "Case Study", kind: "caseStudy", description: "Customer result or transformation proof slide." },
    { suffix: "process", name: "Process", kind: "timeline", description: "Step-by-step process or delivery timeline slide." },
    { suffix: "closing", name: "Closing", kind: "thankYou", description: "Final call-to-action and closing statement slide." },
  ],
  [
    { suffix: "visual", name: "Visual Lead", kind: "split", description: "Image-led value proposition slide." },
    { suffix: "market", name: "Market Map", kind: "map", description: "Market, audience, or territory mapping slide." },
    { suffix: "segments", name: "Segments", kind: "pieChart", description: "Pie chart slide for audience, revenue, or market mix." },
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
    { suffix: "mix", name: "Mix Chart", kind: "pieChart", description: "Pie chart breakdown for channel, product, or budget mix." },
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
    { suffix: "chart", name: "Insight Chart", kind: "chart", description: "Analytical bar and curved line trend slide." },
    { suffix: "table", name: "Details Table", kind: "table", description: "Operational data table slide." },
    { suffix: "risk", name: "Risk Register", kind: "risk", description: "Issue tracking heatmap slide." },
    { suffix: "feature-grid", name: "Feature Grid", kind: "featureGrid", description: "Capability grid slide." },
    { suffix: "roadmap", name: "Roadmap", kind: "roadmap", description: "Next steps and milestones slide." },
    { suffix: "closing", name: "Closing", kind: "thankYou", description: "Closing statement slide." },
  ],
];

const planDescriptions: Record<MegaKind, string> = {
  redEditorial: "Cream and red editorial page with oversized condensed typography.",
  visionMission: "Bold neon and violet vision mission cover slide with editorial typography.",
  hero: "Modern cover slide with a bold headline and strong visual anchor.",
  split: "Split image and narrative slide for a clean value proposition.",
  metrics: "KPI slide with large numbers and proof points.",
  timeline: "Curved timeline slide for sequence, delivery, or milestones.",
  comparison: "Two-column comparison slide for alternatives and tradeoffs.",
  process: "Workflow slide for services, onboarding, or operations.",
  quote: "Quote-led slide for testimony, brand belief, or final emphasis.",
  team: "People and role cards slide for trust building.",
  table: "Structured table slide for facts, scope, or deliverables.",
  chart: "Bar chart with curved trend line for performance storytelling.",
  pieChart: "Pie chart slide for market, budget, or segment breakdown.",
  roadmap: "Roadmap slide for next steps and strategic direction.",
  swot: "SWOT-style matrix slide for strategic planning.",
  pyramid: "Layered hierarchy slide for model, maturity, or priority.",
  funnel: "Funnel slide for sales, conversion, or decision flow.",
  matrix: "Decision matrix slide for priorities and tradeoffs.",
  agenda: "Numbered agenda slide for workshops and meetings.",
  caseStudy: "Case study slide with result metrics and image proof.",
  pricing: "Pricing and package slide for clear offer presentation.",
  risk: "Risk heatmap slide for issues, severity, and mitigation.",
  dashboard: "Dashboard slide with metrics, trend, and business signals.",
  map: "Market map slide for territories, channels, or audience clusters.",
  featureGrid: "Feature grid slide for benefits, capabilities, and modules.",
  beforeAfter: "Before-after slide for transformation and outcomes.",
  thankYou: "Clean closing slide with final call-to-action.",
  portfolio: "Visual portfolio slide for work, products, or gallery proof.",
};

const first20KindSequences: MegaKind[][] = [
  ["hero", "pieChart", "roadmap", "pricing", "caseStudy", "team", "quote"],
  ["split", "funnel", "chart", "dashboard", "comparison", "pricing", "thankYou"],
  ["portfolio", "beforeAfter", "featureGrid", "caseStudy", "pricing", "timeline", "quote"],
  ["map", "portfolio", "pricing", "metrics", "table", "quote", "thankYou"],
  ["featureGrid", "hero", "pieChart", "comparison", "roadmap", "pricing", "quote"],
  ["portfolio", "map", "table", "caseStudy", "metrics", "roadmap", "thankYou"],
  ["agenda", "metrics", "process", "pricing", "quote", "dashboard", "thankYou"],
  ["matrix", "swot", "pyramid", "chart", "timeline", "caseStudy", "quote"],
  ["quote", "metrics", "map", "timeline", "pricing", "featureGrid", "thankYou"],
  ["roadmap", "portfolio", "pricing", "map", "team", "dashboard", "quote"],
  ["split", "metrics", "process", "table", "caseStudy", "quote", "thankYou"],
  ["dashboard", "pieChart", "risk", "chart", "table", "pricing", "quote"],
  ["process", "timeline", "dashboard", "matrix", "featureGrid", "caseStudy", "thankYou"],
  ["risk", "dashboard", "table", "matrix", "roadmap", "quote", "thankYou"],
  ["team", "funnel", "metrics", "pricing", "comparison", "caseStudy", "quote"],
  ["map", "timeline", "portfolio", "pricing", "featureGrid", "quote", "thankYou"],
  ["portfolio", "agenda", "pricing", "beforeAfter", "quote", "team", "thankYou"],
  ["split", "portfolio", "comparison", "pricing", "caseStudy", "roadmap", "quote"],
  ["portfolio", "map", "pyramid", "table", "dashboard", "caseStudy", "thankYou"],
  ["dashboard", "featureGrid", "timeline", "pricing", "risk", "chart", "quote"],
];

const second100KindSequences: MegaKind[][] = [
  ["pieChart", "hero", "matrix", "caseStudy", "roadmap", "pricing", "quote"],
  ["risk", "dashboard", "process", "table", "chart", "featureGrid", "thankYou"],
  ["portfolio", "split", "map", "beforeAfter", "team", "pricing", "quote"],
  ["agenda", "timeline", "metrics", "funnel", "comparison", "caseStudy", "thankYou"],
  ["swot", "pyramid", "matrix", "roadmap", "chart", "pricing", "quote"],
  ["map", "pieChart", "featureGrid", "dashboard", "process", "caseStudy", "thankYou"],
  ["quote", "portfolio", "metrics", "beforeAfter", "table", "roadmap", "pricing"],
  ["chart", "dashboard", "risk", "matrix", "featureGrid", "timeline", "quote"],
  ["team", "process", "pricing", "caseStudy", "map", "metrics", "thankYou"],
  ["funnel", "comparison", "pieChart", "chart", "roadmap", "pricing", "quote"],
];

const makeFirst20Plan = (index: number): PagePlan[] =>
  first20KindSequences[index].map((kind, pageIndex) => ({
    suffix: `custom-${pageIndex + 1}-${kind.toLowerCase()}`,
    name: pageIndex === 0 ? `${kindLabels[kind]} Cover` : kindLabels[kind],
    kind,
    description: planDescriptions[kind],
  }));

const makeSecond100Plan = (index: number): PagePlan[] =>
  second100KindSequences[(index - onlinePresentationServiceDecks.length - featuredConfigs.length) % second100KindSequences.length].map((kind, pageIndex) => ({
    suffix: `edition-${pageIndex + 1}-${kind.toLowerCase()}`,
    name: pageIndex === 0 ? `${kindLabels[kind]} Opener` : `${kindLabels[kind]} Slide`,
    kind,
    description: `${planDescriptions[kind]} This second collection page uses a different visual rhythm from the first 100 templates.`,
  }));

const closingVariants: PagePlan[] = [
  { suffix: "close-quote", name: "Closing Quote", kind: "quote", description: "Final emotional statement with image-led emphasis." },
  { suffix: "close-metrics", name: "Closing Metrics", kind: "metrics", description: "Final slide with the strongest proof numbers." },
  { suffix: "close-chart", name: "Closing Chart", kind: "chart", description: "Final trend slide with a bar chart and curved line." },
  { suffix: "close-pie", name: "Closing Mix", kind: "pieChart", description: "Final pie chart slide for offer, budget, or audience mix." },
  { suffix: "close-roadmap", name: "Next Roadmap", kind: "roadmap", description: "Final next-step roadmap slide." },
  { suffix: "close-pricing", name: "Final Offer", kind: "pricing", description: "Final package and call-to-action slide." },
  { suffix: "close-map", name: "Expansion Close", kind: "map", description: "Final market or service area slide." },
  { suffix: "close-gallery", name: "Showcase Close", kind: "portfolio", description: "Final visual showcase slide." },
  { suffix: "close-features", name: "Benefit Close", kind: "featureGrid", description: "Final benefit grid slide." },
  { suffix: "close-dashboard", name: "Signal Close", kind: "dashboard", description: "Final dashboard slide with business signals." },
  { suffix: "close-case", name: "Result Close", kind: "caseStudy", description: "Final outcome and proof slide." },
  { suffix: "close-clean", name: "Clean Close", kind: "thankYou", description: "Minimal final statement slide." },
];

const getPagePlans = (index: number) => {
  if (index === 0) {
    return [
      { suffix: "cover", name: "Brand Messages Cover", kind: "redEditorial", description: "Oversized red typography cover with image-led brand messaging." },
      { suffix: "audience", name: "Target Audience", kind: "redEditorial", description: "Large red title with ruled table rows for audience definition." },
      { suffix: "positioning", name: "Brand Positioning", kind: "redEditorial", description: "Brand positioning table with bold red labels and concise explanations." },
      { suffix: "timeline", name: "Project Timeline", kind: "redEditorial", description: "Four-phase project timeline with horizontal rules and red milestones." },
      { suffix: "campaign", name: "Campaign Menu", kind: "redEditorial", description: "Photo-led campaign contents slide with large red links and arrow motifs." },
      { suffix: "thanks", name: "Thank You", kind: "redEditorial", description: "Full red closing slide with contact details and image block." },
      { suffix: "brief", name: "Creative Brief", kind: "redEditorial", description: "Split red creative brief cover with bold arrow and team image." },
      { suffix: "strategy", name: "Brand Strategy", kind: "redEditorial", description: "Strategy slide with image split, key focus list, and red typography." },
      { suffix: "style", name: "Visual Style", kind: "redEditorial", description: "Image collage slide for visual direction and aesthetic principles." },
      { suffix: "summary", name: "Summarize", kind: "redEditorial", description: "Summary slide with large image and red rounded message labels." },
    ];
  }
  if (index === 1) {
    return [
      { suffix: "cover", name: "Vision and Mission Cover", kind: "visionMission", description: "Reference-inspired neon green and violet cover slide." },
      { suffix: "goals", name: "Mission Goals", kind: "featureGrid", description: "Goal grid slide for priorities and focus areas." },
      { suffix: "values", name: "Core Values", kind: "quote", description: "Bold value statement slide." },
      { suffix: "roadmap", name: "Action Roadmap", kind: "roadmap", description: "Roadmap slide for turning vision into execution." },
      { suffix: "metrics", name: "Success Metrics", kind: "pieChart", description: "Pie chart slide for success signals." },
      { suffix: "team", name: "Team Alignment", kind: "team", description: "Team role slide for ownership and accountability." },
      { suffix: "close", name: "Final Direction", kind: "thankYou", description: "Clean closing slide with final direction." },
    ];
  }
  if (index < featuredConfigs.length + first20KindSequences.length) {
    return makeFirst20Plan(index - featuredConfigs.length);
  }
  if (index >= featuredConfigs.length + onlinePresentationServiceDecks.length) {
    return makeSecond100Plan(index);
  }
  const plans = [...pagePlanPresets[index % pagePlanPresets.length]];
  plans[plans.length - 1] = closingVariants[index % closingVariants.length];
  return plans;
};

const subtitleTemplates = [
  (cfg: MegaConfig, page: PagePlan) => `${page.description} Built for ${cfg.name} with a focused story arc and clear visual hierarchy.`,
  (cfg: MegaConfig, page: PagePlan) => `A ${page.name.toLowerCase()} slide for ${cfg.name}, shaped around audience pain, proof, and action.`,
  (cfg: MegaConfig, page: PagePlan) => `${cfg.name} uses this page to turn scattered details into a clean, presentation-ready narrative.`,
  (cfg: MegaConfig, page: PagePlan) => `Designed for ${cfg.name}, with editable sections and a clean structure for fast client delivery.`,
  (cfg: MegaConfig, page: PagePlan) => `A sharp ${page.kind.replace(/([A-Z])/g, " $1").toLowerCase()} layout that keeps the message visual and easy to scan.`,
];

const quoteTemplates = [
  (cfg: MegaConfig) => `${cfg.name} should make the buyer understand the offer before the presenter finishes speaking.`,
  (cfg: MegaConfig) => `Strong presentations do not explain everything; they guide the room toward the next confident move.`,
  (cfg: MegaConfig) => `${cfg.name} works best when the story is specific, visual, and easy to edit for each client.`,
  (cfg: MegaConfig) => `A memorable deck turns raw business ideas into a sequence people can believe and act on.`,
  (cfg: MegaConfig) => `Every slide earns its place by making the audience see the value faster.`,
  (cfg: MegaConfig) => `${cfg.name} is built to feel polished, practical, and ready for real sales conversations.`,
];

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
  const subtitle = subtitleTemplates[(groupIndex + pageIndex) % subtitleTemplates.length](cfg, page);
  const quote = quoteTemplates[(groupIndex + pageIndex) % quoteTemplates.length](cfg);
  const Schema = makeSchema(pageConfig.name, pageConfig.imageUrl, subtitle, quote);
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
