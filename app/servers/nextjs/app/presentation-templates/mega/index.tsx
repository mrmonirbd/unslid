import React from "react";
import * as z from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { onlinePresentationServiceDecks } from "../../presentation-decks/onlinePresentationServiceDecks";
import { createTemplateEntry, TemplateLayoutsWithSettings, TemplateWithData } from "../utils";

type MegaKind =
  | "personalPortfolio"
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
  visualMode: number;
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

const baseChartData = [
  { label: "Q1", value: 42, note: "Baseline" },
  { label: "Q2", value: 68, note: "Adoption" },
  { label: "Q3", value: 52, note: "Optimization" },
  { label: "Q4", value: 86, note: "Expansion" },
  { label: "Q5", value: 74, note: "Retention" },
  { label: "Q6", value: 94, note: "Scale" },
];

type MegaSchemaDefaults = {
  items?: typeof baseItems;
  metrics?: typeof baseMetrics;
  rows?: typeof baseRows;
  chartData?: typeof baseChartData;
};

function makeSchema(title: string, imageUrl: string, subtitle: string, quote: string, defaults: MegaSchemaDefaults = {}) {
  return z.object({
    title: z.string().max(120).default(title),
    subtitle: z.string().max(220).default(subtitle),
    quote: z.string().max(220).default(quote),
    imageUrl: z.string().default(imageUrl),
    image: z.object({
      __image_url__: z.string(),
      __image_prompt__: z.string().max(100),
    }).default({
      __image_url__: imageUrl,
      __image_prompt__: `${title} presentation image`.slice(0, 100),
    }),
    items: z.array(z.object({
      label: z.string().max(40),
      text: z.string().max(160),
    })).default(defaults.items || baseItems),
    metrics: z.array(z.object({
      label: z.string().max(30),
      value: z.string().max(24),
      note: z.string().max(80),
    })).default(defaults.metrics || baseMetrics),
    rows: z.array(z.object({
      label: z.string().max(36),
      value: z.string().max(42),
      note: z.string().max(100),
    })).default(defaults.rows || baseRows),
    chartData: z.array(z.object({
      label: z.string().max(24).describe("Short chart axis or segment label, such as Q1, Mobile, Enterprise, or Retention."),
      value: z.number().min(1).max(100).describe("Numeric chart value from 1 to 100. This directly controls bar height, line position, and pie slice size."),
      note: z.string().max(80).describe("Short context for this chart point."),
    })).min(4).max(6).describe("Chart values that must match the slide topic. Generate fresh values for chart, pie chart, and dashboard slides.").default(defaults.chartData || baseChartData),
  });
}

const clampText = (value: unknown, maxLength: number, fallback = "") => {
  const text = typeof value === "string" ? value : fallback;
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text;
};

const isMissingImageUrl = (value: unknown) => {
  if (typeof value !== "string") return true;
  const url = value.trim();
  if (!url) return true;
  return (
    url.includes("/static/images/placeholder") ||
    url.includes("placeholder.jpg") ||
    url.includes("via.placeholder.com") ||
    url.includes("replaceable_template_image.png")
  );
};

const firstUsableImageUrl = (...urls: unknown[]) => {
  const usable = urls.find((url) => !isMissingImageUrl(url));
  return typeof usable === "string" ? usable : "";
};

const parseChartValue = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(1, Math.round(value)));
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) {
      return Math.min(100, Math.max(1, Math.round(parsed)));
    }
  }
  return fallback;
};

const normalizeMegaData = (data: unknown) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const source = data as Record<string, unknown>;

  return {
    ...source,
    title: clampText(source.title, 120),
    subtitle: clampText(source.subtitle, 220),
    quote: clampText(source.quote, 220),
    image: source.image && typeof source.image === "object" && !Array.isArray(source.image)
      ? {
          ...(source.image as Record<string, unknown>),
          __image_url__: clampText((source.image as Record<string, unknown>).__image_url__, 1000, clampText(source.imageUrl, 1000)),
          __image_prompt__: clampText((source.image as Record<string, unknown>).__image_prompt__, 100, clampText(source.title, 100, "Presentation image")),
        }
      : {
          __image_url__: clampText(source.imageUrl, 1000),
          __image_prompt__: clampText(source.title, 100, "Presentation image"),
        },
    items: Array.isArray(source.items)
      ? source.items.map((item, index) => {
          const fallback = baseItems[index % baseItems.length];
          if (!item || typeof item !== "object" || Array.isArray(item)) return fallback;
          const record = item as Record<string, unknown>;
          return {
            ...record,
            label: clampText(record.label, 40, fallback.label),
            text: clampText(record.text, 160, fallback.text),
          };
        })
      : source.items,
    metrics: Array.isArray(source.metrics)
      ? source.metrics.map((metric, index) => {
          const fallback = baseMetrics[index % baseMetrics.length];
          if (!metric || typeof metric !== "object" || Array.isArray(metric)) return fallback;
          const record = metric as Record<string, unknown>;
          return {
            ...record,
            label: clampText(record.label, 30, fallback.label),
            value: clampText(record.value, 24, fallback.value),
            note: clampText(record.note, 80, fallback.note),
          };
        })
      : source.metrics,
    rows: Array.isArray(source.rows)
      ? source.rows.map((row, index) => {
          const fallback = baseRows[index % baseRows.length];
          if (!row || typeof row !== "object" || Array.isArray(row)) return fallback;
          const record = row as Record<string, unknown>;
          return {
            ...record,
            label: clampText(record.label, 36, fallback.label),
            value: clampText(record.value, 42, fallback.value),
            note: clampText(record.note, 100, fallback.note),
          };
        })
      : source.rows,
    chartData: Array.isArray(source.chartData)
      ? source.chartData.map((point, index) => {
          const fallback = baseChartData[index % baseChartData.length];
          if (!point || typeof point !== "object" || Array.isArray(point)) return fallback;
          const record = point as Record<string, unknown>;
          return {
            ...record,
            label: clampText(record.label, 24, fallback.label),
            value: parseChartValue(record.value, fallback.value),
            note: clampText(record.note, 80, fallback.note),
          };
        }).concat(baseChartData).slice(0, 6)
      : source.chartData,
  };
};

const textStyle = { letterSpacing: 0 };

const getMegaTheme = (cfg: MegaConfig) => ({
  accent: `var(--primary-color, ${cfg.accent})`,
  bg: `var(--background-color, ${cfg.bg})`,
  fg: `var(--background-text, ${cfg.fg})`,
  soft: `var(--card-color, ${cfg.soft})`,
  stroke: `var(--stroke, ${cfg.soft})`,
  primaryText: "var(--primary-text, #ffffff)",
  headingFont: "var(--heading-font-family, Inter, Arial, sans-serif)",
  bodyFont: "var(--body-font-family, Inter, Arial, sans-serif)",
});

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const parsed = Number.parseInt(value, 16);
  if (!Number.isFinite(parsed)) return { r: 15, g: 23, b: 42 };
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const alpha = (hex: string, opacity: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const getShellBackground = (cfg: MegaConfig) => {
  const mode = cfg.visualMode % 8;
  const accent = alpha(cfg.accent, 0.28);
  const soft = alpha(cfg.soft, 0.78);

  const backgrounds = [
    `radial-gradient(circle at 10% 12%, ${accent} 0, transparent 30%), radial-gradient(circle at 92% 84%, ${soft} 0, transparent 34%), ${cfg.bg}`,
    `linear-gradient(135deg, ${cfg.bg} 0%, ${cfg.bg} 48%, ${soft} 48%, ${soft} 100%)`,
    `radial-gradient(ellipse at 50% -10%, ${accent} 0, transparent 42%), linear-gradient(180deg, ${cfg.bg}, ${alpha(cfg.soft, 0.38)})`,
    `linear-gradient(90deg, ${alpha(cfg.soft, 0.64)} 0 18%, transparent 18% 100%), ${cfg.bg}`,
    `conic-gradient(from 210deg at 84% 16%, ${accent}, transparent 18%, ${cfg.bg} 46%, ${soft} 80%, ${cfg.bg})`,
    `linear-gradient(160deg, ${cfg.bg} 0%, ${cfg.bg} 62%, ${alpha(cfg.accent, 0.2)} 62%, ${alpha(cfg.accent, 0.2)} 100%)`,
    `radial-gradient(circle at 78% 22%, ${accent} 0, transparent 22%), radial-gradient(circle at 14% 78%, ${soft} 0, transparent 28%), ${cfg.bg}`,
    `repeating-linear-gradient(135deg, transparent 0 18px, ${alpha(cfg.soft, 0.22)} 18px 19px), ${cfg.bg}`,
  ];

  return backgrounds[mode];
};

const shellRadius = (cfg: MegaConfig) => {
  const radii = ["rounded-xl", "rounded-none", "rounded-[28px]", "rounded-lg", "rounded-[40px]", "rounded-sm", "rounded-2xl", "rounded-[20px]"];
  return radii[cfg.visualMode % radii.length];
};

const getImageVariant = (imageUrl: string, variant: string | number, width = 900, height = 700) => {
  const picsumSeedMatch = imageUrl.match(/\/seed\/([^/]+)\/\d+\/\d+/);
  if (picsumSeedMatch) {
    return `https://picsum.photos/seed/${picsumSeedMatch[1]}-${variant}/${width}/${height}`;
  }
  const separator = imageUrl.includes("?") ? "&" : "?";
  return `${imageUrl}${separator}variant=${variant}`;
};

const Shell = ({ cfg, children }: { cfg: MegaConfig; children: React.ReactNode }) => (
  <div
    className={`relative mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] overflow-hidden border shadow-2xl ${shellRadius(cfg)}`}
    style={{
      background: getShellBackground(cfg),
      borderColor: getMegaTheme(cfg).stroke,
      color: getMegaTheme(cfg).fg,
      fontFamily: getMegaTheme(cfg).bodyFont,
    }}
  >
    <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-80" viewBox="0 0 1280 720" preserveAspectRatio="none">
      {cfg.curve % 4 === 0 && <path d="M0 560 C220 450 360 690 610 555 C830 435 970 545 1280 410 L1280 720 L0 720 Z" fill={getMegaTheme(cfg).soft} />}
      {cfg.curve % 4 === 1 && <path d="M780 0 C900 140 1120 70 1280 210 L1280 0 Z" fill={getMegaTheme(cfg).soft} />}
      {cfg.curve % 4 === 2 && <path d="M0 0 C210 110 270 270 145 455 C90 535 45 625 0 720 Z" fill={getMegaTheme(cfg).soft} />}
      {cfg.curve % 4 === 3 && <path d="M360 720 C490 520 780 670 940 420 C1040 260 1160 220 1280 240 L1280 720 Z" fill={getMegaTheme(cfg).soft} />}
      <circle cx={cfg.curve % 2 ? 1060 : 180} cy={cfg.curve % 3 ? 140 : 560} r="86" fill={getMegaTheme(cfg).accent} opacity="0.12" />
      {cfg.visualMode % 3 === 0 && <path d="M96 92H1184M96 628H1184" stroke={getMegaTheme(cfg).fg} strokeOpacity="0.08" strokeWidth="2" />}
      {cfg.visualMode % 3 === 1 && <path d="M160 0V720M1120 0V720" stroke={getMegaTheme(cfg).accent} strokeOpacity="0.14" strokeWidth="18" />}
      {cfg.visualMode % 3 === 2 && <path d="M0 120H1280M0 600H1280" stroke={getMegaTheme(cfg).soft} strokeOpacity="0.7" strokeWidth="72" />}
    </svg>
    <div
      className={`absolute z-20 border px-3 py-1 text-xs font-semibold backdrop-blur ${cfg.visualMode % 2 ? "left-8 top-8 rounded-md" : "right-8 top-8 rounded-full"}`}
      style={{ background: getMegaTheme(cfg).soft, borderColor: getMegaTheme(cfg).stroke, color: getMegaTheme(cfg).fg }}
    >
      {cfg.name}
    </div>
    <div className="relative z-10 h-full w-full">
      {children}
    </div>
  </div>
);

const MetricCard = ({ metric, cfg }: { metric: { label: string; value: string; note: string }; cfg: MegaConfig }) => (
  <div className="rounded-2xl border p-5 shadow-sm backdrop-blur" style={{ background: getMegaTheme(cfg).soft, borderColor: getMegaTheme(cfg).stroke }}>
    <div className="text-sm font-semibold opacity-75">{metric.label}</div>
    <div className="mt-2 text-5xl font-black" style={{ color: getMegaTheme(cfg).accent, ...textStyle }}>{metric.value}</div>
    <div className="mt-2 text-sm opacity-80">{metric.note}</div>
  </div>
);

const BuiltInChart = ({
  cfg,
  chartData,
  variant = "bar",
}: {
  cfg: MegaConfig;
  chartData: typeof baseChartData;
  variant?: "bar" | "line" | "pie" | "dashboard";
}) => {
  const theme = getMegaTheme(cfg);
  const rows = chartData.slice(0, 6).map((point, index) => ({
    ...point,
    value2: Math.max(8, Math.round(point.value * (0.62 + (index % 3) * 0.12))),
  }));
  const axisProps = {
    axisLine: false,
    tickLine: false,
    tick: { fill: theme.fg, fillOpacity: 0.72, fontSize: 12, fontWeight: 600 },
  };
  const gridProps = {
    vertical: false,
    stroke: theme.fg,
    strokeOpacity: 0.1,
  };
  const colors = [theme.accent, theme.fg, theme.soft, alpha(cfg.accent, 0.55), alpha(cfg.fg, 0.45)];

  if (variant === "pie") {
    return (
      <ResponsiveContainer width="100%" height={330}>
        <PieChart>
          <Tooltip cursor={{ fill: "transparent" }} />
          <Pie
            data={rows.slice(0, 5)}
            dataKey="value"
            nameKey="label"
            innerRadius={74}
            outerRadius={130}
            paddingAngle={3}
            label={(entry: any) => `${entry.name} ${Math.round((entry.percent ?? 0) * 100)}%`}
            labelLine={false}
          >
            {rows.slice(0, 5).map((point, index) => (
              <Cell key={point.label} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ color: theme.fg, fontSize: 12, fontWeight: 600 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (variant === "line") {
    return (
      <ResponsiveContainer width="100%" height={330}>
        <LineChart data={rows} margin={{ top: 22, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} dy={10} />
          <YAxis {...axisProps} width={38} />
          <Tooltip cursor={{ stroke: theme.accent, strokeOpacity: 0.18 }} />
          <Legend iconType="circle" verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 600 }} />
          <Line type="monotone" dataKey="value" name="Current" stroke={theme.accent} strokeWidth={4} dot={{ fill: theme.accent, r: 5 }} />
          <Line type="monotone" dataKey="value2" name="Previous" stroke={alpha(cfg.fg, 0.42)} strokeWidth={3} dot={{ fill: alpha(cfg.fg, 0.42), r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (variant === "dashboard") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={rows.slice(0, 5)} margin={{ top: 20, right: 24, left: 0, bottom: 8 }} barGap={4}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="label" {...axisProps} dy={10} />
          <YAxis {...axisProps} width={38} />
          <Tooltip cursor={{ fill: alpha(cfg.accent, 0.08) }} />
          <Legend iconType="circle" verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 600 }} />
          <Bar dataKey="value" name="Actual" fill={theme.accent} radius={[6, 6, 0, 0]} />
          <Bar dataKey="value2" name="Target" fill={alpha(cfg.fg, 0.34)} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={330}>
      <BarChart data={rows} margin={{ top: 22, right: 24, left: 0, bottom: 8 }} barGap={2}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...axisProps} dy={10} />
        <YAxis {...axisProps} width={38} />
        <Tooltip cursor={{ fill: alpha(cfg.accent, 0.08) }} />
        <Legend iconType="circle" verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 600 }} />
        <Bar dataKey="value" name="Primary" fill={theme.accent} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

function renderLayout(cfg: MegaConfig, data: z.infer<ReturnType<typeof makeSchema>>) {
  const title = data.title;
  const subtitle = data.subtitle;
  const quote = data.quote;
  const items = data.items?.length ? data.items : baseItems;
  const metrics = data.metrics?.length ? data.metrics : baseMetrics;
  const rows = data.rows?.length ? data.rows : baseRows;
  const chartData = data.chartData?.length ? data.chartData : baseChartData;
  const imageUrl = firstUsableImageUrl(data.image?.__image_url__, data.imageUrl, cfg.imageUrl);
  const theme = getMegaTheme(cfg);

  switch (cfg.kind) {
    case "personalPortfolio": {
      const dark = theme.accent;
      const paper = theme.bg;
      const ink = theme.fg;
      const page = cfg.id.split("-").pop() || "cover";
      const imageFor = (_seed: string, _width = 900, _height = 640) => imageUrl;
      const Blob = ({ className = "" }: { className?: string }) => (
        <div className={`pointer-events-none absolute h-32 w-32 rounded-full blur-2xl ${className}`} style={{ background: `radial-gradient(circle, ${theme.soft}, ${theme.accent} 45%, transparent 70%)`, opacity: 0.45 }} />
      );
      const Logo = ({ light = false }: { light?: boolean }) => (
        <div className="grid h-9 w-9 grid-cols-2 gap-1">
          {[0, 1, 2, 3].map((dot) => <span key={dot} className="rounded-full" style={{ background: light ? theme.primaryText : ink }} />)}
        </div>
      );
      const Nav = () => <div className="absolute right-10 top-10 text-4xl font-light tracking-tight" style={{ color: ink }}>‹›</div>;
      const portfolioSections = [title, ...items.map((item) => item.label), ...rows.map((row) => row.label)]
        .filter(Boolean)
        .slice(0, 7);
      const portfolioBody = items[0]?.text || rows[0]?.note || subtitle;

      if (page === "contents") {
        const contents = portfolioSections.length ? portfolioSections : ["About Me", "Education", "Experience", "Creative Strengths", "Projects", "Achievements", "Career Goals"];
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.82fr_1fr] overflow-hidden" style={{ background: paper, color: ink, fontFamily: "Inter, Arial, sans-serif" }}>
            <div className="grid grid-rows-[1fr_140px]" style={{ background: dark }}>
              <img src={imageFor("contents-studio", 680, 430)} alt="" className="h-full w-full object-cover" />
              <div className="flex items-center px-[72px] text-sm" style={{ color: theme.primaryText }}>Portfolio 2026</div>
            </div>
            <div className="relative px-12 py-16">
              <Nav /><Blob className="right-20 top-44" /><Blob className="bottom-8 left-44" />
              <h1 className="text-[58px] font-black uppercase leading-none" style={{ fontFamily: "Impact, Arial Black, Inter, sans-serif" }}>{title}</h1>
              <div className="mt-5 max-w-[470px]">
                {contents.map((item, index) => (
                  <div key={item} className="grid grid-cols-[1fr_60px] border-b py-1 text-[30px] leading-tight" style={{ borderColor: theme.stroke }}>
                    <span>{item}</span><span className="text-right">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-14 left-12 text-sm">Overview</div>
              <div className="absolute bottom-12 right-12"><Logo /></div>
            </div>
          </div>
        );
      }

      if (page === "about") {
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.43fr_1fr_210px] overflow-hidden" style={{ background: paper, color: ink, fontFamily: "Inter, Arial, sans-serif" }}>
            <div className="grid grid-rows-[1fr_140px]" style={{ background: dark }}>
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              <div className="flex items-center px-16 text-sm" style={{ color: theme.primaryText }}>Portfolio 2026</div>
            </div>
            <div className="relative px-[56px] py-[72px]">
              <Blob className="left-56 top-0" />
              <h1 className="text-[58px] font-black uppercase" style={{ fontFamily: "Impact, Arial Black, Inter, sans-serif" }}>{title}</h1>
              <h2 className="mt-6 text-3xl">{subtitle}</h2>
              <p className="mt-6 max-w-[560px] text-[15px] leading-snug">{portfolioBody}</p>
              <p className="mt-7 max-w-[560px] text-[15px] leading-snug">{items[1]?.text || rows[1]?.note || quote}</p>
              <div className="absolute bottom-[56px] left-[56px] text-sm">{rows[0]?.label || items[0]?.label}</div>
            </div>
            <div className="relative border-l px-8 py-20" style={{ borderColor: theme.stroke }}>
              <Nav />
              <img src={imageUrl} alt="" className="mt-12 h-36 w-full object-cover" />
              <img src={imageUrl} alt="" className="mt-5 h-36 w-full object-cover" />
              <div className="absolute bottom-12 right-9"><Logo /></div>
            </div>
          </div>
        );
      }

      if (page === "education" || page === "strengths") {
        const isStrength = page === "strengths";
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.75fr_1.1fr] overflow-hidden" style={{ background: paper, color: ink, fontFamily: "Inter, Arial, sans-serif" }}>
            <div className="relative flex flex-col justify-center px-[72px]">
              <Blob className="left-56 top-20" /><Blob className="bottom-10 left-64" />
              <h1 className="text-[62px] font-black uppercase leading-none" style={{ fontFamily: "Impact, Arial Black, Inter, sans-serif" }}>{title}</h1>
              <h2 className="mt-8 text-3xl">{subtitle}</h2>
              <p className="mt-6 max-w-[520px] text-[15px] leading-snug">{portfolioBody}</p>
              {isStrength && <ul className="mt-5 list-disc pl-5 text-[15px] leading-snug">{items.slice(0, 4).map((item) => <li key={item.label}>{item.label}</li>)}</ul>}
              <div className="absolute bottom-[56px] left-[72px] text-sm">{rows[0]?.label || items[0]?.label}</div>
            </div>
            <div className="grid grid-rows-[80px_1fr_110px]" style={{ background: dark }}>
              <div className="relative"><Nav /></div>
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="flex items-center justify-between px-8 text-sm" style={{ color: theme.primaryText }}><span>Portfolio 2026</span><Logo light /></div>
            </div>
          </div>
        );
      }

      if (page === "experience" || page === "goals" || page === "thanks") {
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.75fr_1fr] overflow-hidden" style={{ background: paper, color: ink, fontFamily: "Inter, Arial, sans-serif" }}>
            <div className="grid grid-rows-[1fr_140px]" style={{ background: dark }}>
              <img
                src={
                  imageUrl
                }
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="flex items-center px-[72px] text-sm" style={{ color: theme.primaryText }}>{rows[0]?.label || items[0]?.label}</div>
            </div>
            <div className="relative border-l px-[64px] py-[72px]" style={{ borderColor: theme.stroke }}>
              <Nav /><Blob className="right-40 top-36" /><Blob className="bottom-12 left-72" />
              <h1 className="text-[64px] font-black uppercase leading-none" style={{ fontFamily: "Impact, Arial Black, Inter, sans-serif" }}>{title}</h1>
              <h2 className="mt-8 text-3xl">{subtitle}</h2>
              <p className="mt-6 max-w-[620px] text-[15px] leading-snug">{portfolioBody}</p>
              {page === "experience" && <div className="mt-7 space-y-3 text-sm">{rows.slice(0, 3).map((row) => <div key={row.label}><strong>{row.label}</strong><p>{row.value || row.note}</p></div>)}</div>}
              {page === "thanks" && <div className="mt-8 space-y-2 text-sm">{rows.slice(0, 3).map((row) => <p key={row.label}>{row.label}: {row.value || row.note}</p>)}</div>}
              <div className="absolute bottom-12 right-12"><Logo /></div>
            </div>
          </div>
        );
      }

      if (page === "projects" || page === "achievements") {
        const isProjects = page === "projects";
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.48fr_0.6fr_0.56fr] overflow-hidden" style={{ background: paper, color: ink, fontFamily: "Inter, Arial, sans-serif" }}>
            <div className="grid grid-rows-[1fr_140px]" style={{ background: dark }}>
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="flex items-center px-[72px] text-sm" style={{ color: theme.primaryText }}>Portfolio 2026</div>
            </div>
            <div className="relative px-10 py-28">
              <Blob className="right-10 top-8" />
              <h1 className="text-[58px] font-black uppercase leading-none" style={{ fontFamily: "Impact, Arial Black, Inter, sans-serif" }}>{title}</h1>
              <h2 className="mt-8 text-3xl">{subtitle}</h2>
              <p className="mt-6 text-[15px] leading-snug">{portfolioBody}</p>
              <ul className="mt-7 list-disc pl-5 text-sm leading-snug">{items.slice(0, 4).map((item) => <li key={item.label}>{item.label}</li>)}</ul>
              <div className="absolute bottom-14 left-10 text-sm">{rows[0]?.label || (isProjects ? "Work Samples" : "Achievements")}</div>
            </div>
            <div className="relative border-l p-8" style={{ borderColor: theme.stroke }}>
              <Nav />
              <div className="mt-14 grid h-[460px] grid-rows-3 gap-5">
                {(isProjects
                  ? [imageUrl, imageUrl, imageUrl]
                  : [imageUrl, imageUrl, imageUrl]
                ).map((src, index) => <img key={`${src}-${index}`} src={src} alt="" className="h-full w-full object-cover" />)}
              </div>
              <div className="absolute bottom-12 right-9"><Logo /></div>
            </div>
          </div>
        );
      }

      return (
        <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.92fr_1.08fr] overflow-hidden" style={{ background: paper, color: ink, fontFamily: "Inter, Arial, sans-serif" }}>
          <div className="relative flex flex-col justify-between p-[72px]">
            <Blob className="right-24 top-4" /><Blob className="bottom-28 right-20" />
            <div>
              <p className="text-sm">{rows[0]?.label || "Portfolio"}</p>
              <h1 className="mt-12 text-[78px] font-black uppercase leading-[0.96]" style={{ fontFamily: "Impact, Arial Black, Inter, sans-serif" }}>{title}</h1>
              <p className="mt-8 text-2xl uppercase leading-tight">{subtitle}</p>
              <button className="mt-12 rounded-full px-5 py-2 text-sm" style={{ background: dark, color: theme.primaryText }}>See more ›</button>
            </div>
            <div className="flex justify-between text-sm"><span>{items[0]?.label}</span><span>{items[1]?.label}</span></div>
          </div>
          <div className="grid grid-rows-[70px_1fr_130px]" style={{ background: dark }}>
            <div className="relative"><Nav /></div>
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            <div className="grid grid-cols-[54px_1fr] items-center gap-4 px-8" style={{ color: theme.primaryText }}><Logo light /><p className="text-sm leading-tight">{portfolioBody}</p></div>
          </div>
        </div>
      );
    }
    case "redEditorial": {
      const red = theme.accent;
      const cream = theme.bg;
      const black = theme.fg;
      const page = cfg.id.split("-").pop() || "cover";
      const imageFor = (_seed: string, _width = 1200, _height = 900) => imageUrl;
      const redImageStyle = { filter: "saturate(1.18) contrast(1.08)" };
      const Arrow = ({ className = "" }: { className?: string }) => (
        <svg className={className} width="92" height="92" viewBox="0 0 92 92" fill="none">
          <path d="M16 18H74V76" stroke="currentColor" strokeWidth="10" />
          <path d="M74 18L18 74" stroke="currentColor" strokeWidth="10" />
        </svg>
      );
      const Rule = () => <div className="h-[3px] w-full" style={{ background: theme.stroke }} />;
      const generatedRows = data.rows?.length
        ? data.rows
        : data.metrics?.length
          ? data.metrics.map((metric) => ({
              label: metric.label,
              value: [metric.value, metric.note].filter(Boolean).join(" - "),
              note: metric.note,
            }))
          : data.items?.map((item) => ({
              label: item.label,
              value: item.text,
              note: "",
            })) || [];
      const editorialRows = generatedRows.length ? generatedRows : baseRows;
      const editorialItems = data.items?.length ? data.items : editorialRows.map((row) => ({
        label: row.label,
        text: row.value || row.note,
      }));

      if (page === "audience") {
        return (
          <div className="mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] flex-col overflow-hidden px-10 py-9" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <h1 className="text-[112px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.04em" }}>{title}</h1>
            <p className="mt-4 max-w-[760px] text-3xl font-medium leading-tight">{subtitle}</p>
            <div className="mt-12 flex flex-1 flex-col justify-between">
              {editorialRows.slice(0, 3).map((row, index) => (
                <div key={`${row.label}-${index}`}>
                  <Rule />
                  <div className="grid grid-cols-[1fr_0.9fr] py-8">
                    <div className="text-2xl font-black uppercase" style={{ color: red }}>({row.label})</div>
                    <div className="whitespace-pre-line text-2xl font-medium leading-tight">{row.value || row.note}</div>
                  </div>
                </div>
              ))}
              <Rule />
            </div>
          </div>
        );
      }

      if (page === "positioning") {
        return (
          <div className="mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] flex-col overflow-hidden px-10 py-9" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <h1 className="text-[112px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.04em" }}>{title}</h1>
            <p className="mt-4 max-w-[780px] text-3xl font-medium leading-tight">{subtitle}</p>
            <div className="mt-20 flex flex-1 flex-col justify-between">
              {editorialRows.slice(0, 4).map((row, index) => (
                <div key={`${row.label}-${index}`}>
                  <Rule />
                  <div className="grid grid-cols-[1.35fr_1fr] py-7">
                    <div className="text-2xl font-black uppercase" style={{ color: red }}>{row.label}</div>
                    <div className="whitespace-pre-line text-2xl font-medium leading-tight">{row.value || row.note}</div>
                  </div>
                </div>
              ))}
              <Rule />
            </div>
          </div>
        );
      }

      if (page === "timeline") {
        return (
          <div className="mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] flex-col overflow-hidden px-10 py-9" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <h1 className="text-[112px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.04em" }}>{title}</h1>
            <p className="mt-4 max-w-[780px] text-3xl font-medium leading-tight">{subtitle}</p>
            <div className="mt-28 flex flex-1 flex-col justify-between">
              {editorialRows.slice(0, 4).map((row, index) => (
                <div key={`${row.label}-${index}`}>
                  <Rule />
                  <div className="grid grid-cols-[130px_150px_1fr_0.55fr] items-center py-5">
                    <div className="text-2xl font-black uppercase">Phase {index + 1}</div>
                    <div className="h-[3px]" style={{ background: black }} />
                    <div className="pl-8 text-2xl font-black uppercase" style={{ color: red }}>{row.label}</div>
                    <div className="whitespace-pre-line text-xl leading-tight">{row.value || row.note}</div>
                  </div>
                </div>
              ))}
              <Rule />
            </div>
          </div>
        );
      }

      if (page === "campaign") {
        const links = [title, ...editorialItems.map((item) => item.label)].filter(Boolean).slice(0, 5);
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.62fr_1fr] gap-14 overflow-hidden px-10 py-10" style={{ background: cream, color: red, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <img src={imageFor("campaign-reader", 720, 980)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
            <div className="flex flex-col justify-between">
              {links.map((label, index) => (
                <div key={label}>
                  <div className="grid grid-cols-[60px_1fr_82px] items-center gap-6">
                    <div className="text-xl font-medium">({String(index + 1).padStart(2, "0")})</div>
                    <div className="text-[72px] font-black uppercase leading-none" style={{ letterSpacing: "-0.04em" }}>{label}</div>
                    <Arrow />
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
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[1fr_0.82fr] overflow-hidden p-10" style={{ background: red, color: theme.primaryText, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <div className="flex flex-col justify-between">
              <h1 className="text-[112px] font-black uppercase leading-none" style={{ letterSpacing: "-0.05em" }}>{title}</h1>
              <p className="max-w-[680px] text-[32px] uppercase leading-tight">{subtitle}</p>
              <div className="space-y-8 text-[24px] uppercase">
                {editorialRows.slice(0, 3).map((row, index) => (
                  <div key={`${row.label}-${index}`}>
                    <div>{row.label}:</div>
                    <strong>{row.value || row.note}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <Arrow className="ml-auto" />
              <img src={imageFor("thanks-studio", 780, 320)} alt="" className="h-[270px] w-full object-cover" style={redImageStyle} />
            </div>
          </div>
        );
      }

      if (page === "brief") {
        return (
          <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[0.92fr_1fr] overflow-hidden" style={{ background: cream, color: red, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <div className="flex flex-col justify-between p-10" style={{ background: red, color: theme.primaryText }}>
              <h1 className="text-[104px] font-black uppercase leading-[0.9]" style={{ letterSpacing: "-0.05em" }}>{title}</h1>
              <p className="max-w-[520px] text-3xl uppercase leading-tight">{subtitle}</p>
              <Arrow className="mx-auto" />
              <div className="grid grid-cols-2 text-2xl uppercase">
                <strong>{editorialRows[0]?.label}</strong>
                <strong>{editorialRows[1]?.label || editorialItems[0]?.label}</strong>
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
              <h1 className="text-[92px] font-black uppercase leading-[0.92]" style={{ color: red, letterSpacing: "-0.05em" }}>{title}</h1>
              <p className="max-w-[580px] text-2xl leading-tight">{subtitle}</p>
              <div>
                <strong className="text-xl uppercase">(Key Focus)</strong>
                <div className="mt-6 space-y-3 text-3xl uppercase">
                  {editorialRows.slice(0, 3).map((row, index) => (
                    <div key={`${row.label}-${index}`}>{row.label}</div>
                  ))}
                </div>
              </div>
              {quote && <p className="max-w-[620px] text-xl font-semibold uppercase" style={{ color: red }}>{quote}</p>}
              <Arrow className="ml-auto" />
            </div>
          </div>
        );
      }

      if (page === "style") {
        return (
          <div className="mx-auto flex aspect-video max-h-[720px] w-full max-w-[1280px] flex-col overflow-hidden px-10 py-10" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
            <div className="grid grid-cols-[1fr_0.32fr]">
              <h1 className="text-[104px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.05em" }}>{title}</h1>
              <p className="pt-8 text-2xl leading-tight">{subtitle}</p>
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
              <h1 className="text-[104px] font-black uppercase leading-none" style={{ color: red, letterSpacing: "-0.05em" }}>{title}</h1>
              <p className="pt-10 text-2xl leading-tight">{subtitle}</p>
            </div>
            <div className="relative mt-12 flex-1">
              <img src={imageFor("summary-reader", 1180, 460)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
              <div className="absolute bottom-5 left-6 rounded-full px-8 py-4 text-2xl uppercase" style={{ background: red, color: theme.primaryText }}>{editorialRows[0]?.label}</div>
              <div className="absolute bottom-5 right-8 rounded-full px-8 py-4 text-2xl uppercase" style={{ background: red, color: theme.primaryText }}>{editorialRows[1]?.label || editorialItems[0]?.label}</div>
            </div>
          </div>
        );
      }

      return (
        <div className="mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[1fr_0.95fr] overflow-hidden" style={{ background: cream, color: black, fontFamily: "Arial Narrow, Impact, Inter, Arial, sans-serif" }}>
          <div className="relative p-10">
            <h1 className="text-[104px] font-black uppercase leading-[0.88]" style={{ color: red, letterSpacing: "-0.055em" }}>{title}</h1>
            <div className="absolute bottom-24 left-10 max-w-[500px]">
              <h2 className="text-3xl font-black uppercase" style={{ color: red }}>{subtitle}</h2>
              <p className="mt-4 text-2xl leading-tight">{editorialItems[0]?.text || quote}</p>
            </div>
            <div className="absolute bottom-10 left-10 max-w-[520px]">
              <h2 className="text-3xl font-black uppercase" style={{ color: red }}>{editorialRows[0]?.label}</h2>
            </div>
          </div>
          <img src={imageFor("brand-messages-red", 760, 720)} alt="" className="h-full w-full object-cover" style={redImageStyle} />
        </div>
      );
    }
    case "visionMission":
      return (
        <div className="relative mx-auto grid aspect-video max-h-[720px] w-full max-w-[1280px] grid-cols-[72px_1fr_450px] overflow-hidden shadow-2xl" style={{ background: theme.bg, color: theme.fg, fontFamily: theme.bodyFont }}>
          <div className="h-full" style={{ background: theme.accent }} />
          <div className="flex flex-col justify-center px-12 py-14">
            <div className="mb-14 inline-flex w-fit rounded-full px-8 py-3 text-4xl font-black" style={{ background: theme.accent, color: theme.primaryText, letterSpacing: 0 }}>
              {items[0]?.label || "VISION"}
            </div>
            <h1 className="max-w-[700px] text-[78px] font-black leading-[0.98]" style={{ letterSpacing: "-0.01em" }}>{title}</h1>
            <p className="mt-10 max-w-[620px] text-[24px] font-semibold uppercase leading-snug tracking-[0.16em]">
              {subtitle}
            </p>
            <p className="mt-14 text-[21px] font-medium">{items[0]?.text || quote}</p>
          </div>
          <div className="relative flex items-center justify-center p-8" style={{ background: theme.soft }}>
            <img src={imageUrl} alt="" className="h-[86%] w-full object-cover shadow-xl" />
            <div className="absolute bottom-14 right-0 flex h-24 w-44 items-center justify-center rounded-l-full" style={{ background: theme.accent, color: theme.primaryText }}>
              <svg width="92" height="42" viewBox="0 0 92 42" fill="none">
                <path d="M8 21H76" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
                <path d="M58 7L78 21L58 35" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
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
              <div className="mb-5 h-2 w-28 rounded-full" style={{ background: theme.accent }} />
              <h1 className="text-6xl font-black leading-[1.02]" style={textStyle}>{title}</h1>
              <p className="mt-6 max-w-xl text-2xl leading-snug opacity-80">{subtitle}</p>
            </div>
            <img src={imageUrl} alt="" className="h-full w-full rounded-xl object-cover" />
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
              <img src={imageUrl} alt="" className="h-full w-full rounded-[32px] object-cover" />
              <div className="absolute bottom-16 left-4 grid w-[86%] grid-cols-2 gap-4">
                {items.slice(0, 4).map((item, index) => (
                  <div key={index} className="rounded-lg p-4 shadow-sm backdrop-blur" style={{ background: theme.soft, color: theme.fg }}>
                    <div className="text-2xl font-black" style={{ color: theme.accent }}>0{index + 1}</div>
                    <h3 className="mt-2 text-lg font-bold">{item.label}</h3>
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
                <path d="M0 72 C160 8 260 112 410 56 C560 0 650 110 820 46 C900 16 950 34 1000 22" fill="none" stroke={theme.accent} strokeWidth="6" strokeLinecap="round" />
              </svg>
              {items.slice(0, 4).map((item, index) => (
                <div key={index} className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-black" style={{ background: theme.accent, color: theme.primaryText }}>{index + 1}</div>
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
                <div key={heading} className="rounded-xl p-8" style={{ background: index ? theme.accent : theme.soft, color: index ? theme.primaryText : theme.fg }}>
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
            <div className="rounded-xl p-8" style={{ background: theme.soft }}>
              <BuiltInChart cfg={cfg} chartData={chartData} variant={cfg.visualMode % 2 ? "line" : "bar"} />
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
                  <div key={row.label} className="rounded-xl p-4" style={{ background: index % 2 ? theme.soft : theme.bg }}>
                    <div className="text-sm font-bold opacity-65">{row.label}</div>
                    <div className="mt-2 text-2xl font-black">{chartData[index]?.value ?? baseChartData[index]?.value}%</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-center rounded-[36px] p-10" style={{ background: theme.soft }}>
              <BuiltInChart cfg={cfg} chartData={chartData} variant="pie" />
              <div className="mt-8 grid grid-cols-4 gap-3 text-center text-xs font-bold">
                {chartData.slice(0, 4).map((point, index) => (
                  <div key={point.label} className="rounded-full px-3 py-2" style={{ background: index === 0 ? theme.accent : theme.bg, color: index === 0 ? theme.primaryText : theme.fg }}>{point.label}</div>
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
            <div className="rounded-xl p-8" style={{ background: theme.soft }}>
              <BuiltInChart cfg={cfg} chartData={chartData} variant="dashboard" />
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
            <div className="mt-10 overflow-hidden rounded-xl border" style={{ borderColor: theme.soft }}>
              {rows.map((row, index) => (
                <div key={row.label} className="grid grid-cols-[0.8fr_0.8fr_1.4fr] gap-6 px-8 py-5" style={{ background: index % 2 ? "transparent" : theme.soft }}>
                  <strong>{row.label}</strong>
                  <span style={{ color: theme.accent }} className="font-bold">{row.value}</span>
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
                <div key={tier} className="relative rounded-2xl p-7" style={{ background: index === 1 ? theme.accent : theme.soft, color: index === 1 ? theme.primaryText : theme.fg }}>
                  <div className="text-sm font-bold uppercase opacity-70">{tier}</div>
                  <div className="mt-5 text-5xl font-black">{["$499", "$1.5k", "$4k"][index]}</div>
                  {items.slice(0, 3).map((item) => (
                    <div key={item.label} className="mt-5 border-t pt-4 text-sm leading-relaxed opacity-85" style={{ borderColor: theme.stroke }}>
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
                    background: index % 5 === 0 ? theme.accent : index % 3 === 0 ? theme.soft : theme.bg,
                    color: index % 5 === 0 ? theme.primaryText : theme.fg,
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
                <div key={`${item.label}-${index}`} className="rounded-2xl p-6" style={{ background: index % 2 ? theme.soft : theme.bg, border: `2px solid ${theme.soft}` }}>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full text-lg font-black" style={{ background: theme.accent, color: theme.primaryText }}>
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
                <div key={`${item.label}-${index}`} className="grid grid-cols-[80px_1fr] items-center rounded-2xl p-4" style={{ background: index % 2 ? theme.soft : theme.bg }}>
                  <div className="text-4xl font-black" style={{ color: theme.accent }}>{String(index + 1).padStart(2, "0")}</div>
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
              <img src={imageUrl} alt="" className="h-64 rounded-[36px] object-cover" />
            </div>
            <div className="grid grid-cols-2 gap-5">
              {metrics.slice(0, 4).map((metric, index) => (
                <div key={metric.label} className="rounded-2xl p-6" style={{ background: index === 0 ? theme.accent : theme.soft, color: index === 0 ? theme.primaryText : theme.fg }}>
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
            <img src={imageUrl} alt="" className="h-full w-full rounded-full object-cover" />
            <div className="flex flex-col justify-center">
              <div className="text-8xl font-black" style={{ color: theme.accent }}>&ldquo;</div>
              <h1 className="max-w-4xl text-5xl font-black leading-tight" style={textStyle}>{quote || title}</h1>
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
                <div key={item.label} className="overflow-hidden rounded-xl" style={{ background: theme.soft }}>
                  <img
                    src={imageUrl}
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
                <div key={heading} className="rounded-xl p-6" style={{ background: theme.soft }}>
                  <h3 className="text-2xl font-black" style={{ color: theme.accent }}>{heading}</h3>
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
                <div key={item.label} className="mx-auto rounded-lg px-8 py-5 text-center" style={{ width: `${95 - index * 15}%`, background: index === 0 ? theme.accent : theme.soft, color: index === 0 ? theme.primaryText : theme.fg }}>
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
            <div className="relative rounded-[36px] p-8" style={{ background: theme.soft }}>
              <svg className="h-full w-full" viewBox="0 0 560 420">
                <path d="M80 250 C120 110 260 120 310 70 C390 -5 510 80 480 190 C455 285 350 260 300 340 C245 420 110 390 80 250Z" fill={theme.bg} stroke={theme.accent} strokeWidth="5" />
                {[120, 210, 310, 420].map((x, i) => <circle key={x} cx={x} cy={[230, 160, 280, 180][i]} r="18" fill={theme.accent} />)}
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
                <div key={item.label} className="rounded-xl p-6" style={{ background: theme.soft }}>
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
    const parsed = Schema.parse(normalizeMegaData(data));
    const imageUrl = firstUsableImageUrl(parsed.image?.__image_url__, parsed.imageUrl, cfg.imageUrl);
    return renderLayout(cfg, {
      ...parsed,
      imageUrl,
      image: {
        ...parsed.image,
        __image_url__: imageUrl,
      },
    });
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
  personalPortfolio: "Personal Portfolio",
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
    visualMode: index % 8,
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
    visualMode: (configIndex * 3 + 1) % 8,
  };
});

const featuredPortfolioConfig: MegaConfig = {
  id: "mega-featured-personal-portfolio",
  name: "Personal Portfolio 2026",
  description: "A 10-page personal portfolio deck with soft gradient blur accents, dark charcoal panels, editorial typography, and fashion-studio inspired image layouts.",
  kind: "personalPortfolio",
  accent: "#2e2e2c",
  bg: "#e9e9e9",
  fg: "#2b2b2b",
  soft: "#d9d9d9",
  imageUrl: "https://picsum.photos/seed/personal-portfolio-featured/900/700",
  curve: 0,
  visualMode: 2,
};

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
  visualMode: 5,
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
  visualMode: 6,
};

const featuredConfigs: MegaConfig[] = [featuredPortfolioConfig, featuredRedEditorialConfig, featuredVisionConfig];

const configs: MegaConfig[] = [...featuredConfigs, ...baseConfigs, ...expansionConfigs];

type PagePlan = { suffix: string; name: string; kind: MegaKind; description: string };

const slugifyTemplateName = (name: string, index: number) => {
  const slug = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");

  return `${slug || "template"}-t${String(index + 1).padStart(3, "0")}`;
};

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
  personalPortfolio: "Personal portfolio page with charcoal panels, soft blur accents, and editorial image layouts.",
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
  ["chart", "portfolio", "pricing", "metrics", "table", "quote", "thankYou"],
  ["featureGrid", "hero", "pieChart", "comparison", "roadmap", "pricing", "quote"],
  ["split", "chart", "table", "caseStudy", "metrics", "roadmap", "thankYou"],
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

const getPagePlans = (index: number): PagePlan[] => {
  if (index === 0) {
    return [
      { suffix: "cover", name: "Portfolio Cover", kind: "personalPortfolio", description: "Personal portfolio cover with split editorial image panel." },
      { suffix: "contents", name: "Table of Content", kind: "personalPortfolio", description: "Table of content page with left studio image and numbered sections." },
      { suffix: "about", name: "About Me", kind: "personalPortfolio", description: "Personal introduction page with supporting image stack." },
      { suffix: "education", name: "Education", kind: "personalPortfolio", description: "Academic background page with dark image block." },
      { suffix: "experience", name: "Experience", kind: "personalPortfolio", description: "Experience page with date ranges and practical exposure." },
      { suffix: "strengths", name: "Creative Strengths", kind: "personalPortfolio", description: "Creative strengths page with bullet list and material image." },
      { suffix: "projects", name: "Projects", kind: "personalPortfolio", description: "Selected work page with project image grid." },
      { suffix: "achievements", name: "Achievements", kind: "personalPortfolio", description: "Milestones and accomplishments page with mixed images." },
      { suffix: "goals", name: "Career Goals", kind: "personalPortfolio", description: "Future vision page with profile summary." },
      { suffix: "thanks", name: "Thank You", kind: "personalPortfolio", description: "Closing contact page with charcoal sidebar." },
    ];
  }
  if (index === 1) {
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
  if (index === 2) {
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
  if (index === 5) {
    return [
      { suffix: "visual-cover", name: "Visual Cover", kind: "split", description: "Image-led opener with a strong narrative panel." },
      { suffix: "gallery", name: "Image Gallery", kind: "portfolio", description: "Four-image portfolio page with separate visual references." },
      { suffix: "proof", name: "Proof Story", kind: "caseStudy", description: "Outcome slide with image proof and metric cards." },
      { suffix: "capabilities", name: "Capabilities", kind: "featureGrid", description: "Capability grid with compact visual hierarchy." },
      { suffix: "team", name: "Team Showcase", kind: "team", description: "People and role cards with separate image crops." },
      { suffix: "roadmap", name: "Delivery Roadmap", kind: "roadmap", description: "Timeline slide for the delivery sequence." },
      { suffix: "closing", name: "Closing Visual", kind: "quote", description: "Closing quote slide with a distinct hero image." },
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

const redEditorialDefaultTitles: Record<string, string> = {
  cover: "Brand Messages",
  audience: "Target Audience",
  positioning: "Brand Positioning",
  timeline: "Project Timeline",
  campaign: "Campaign Menu",
  thanks: "Thank You",
  brief: "Creative Brief",
  strategy: "Brand Strategy",
  style: "Visual Style",
  summary: "Summarize",
};

const redEditorialDefaultSubtitles: Record<string, string> = {
  cover: "A bold campaign system for sharper launch messaging.",
  audience: "Define who the campaign is speaking to and why they care.",
  positioning: "Clarify the promise, proof, and market role of the brand.",
  timeline: "A focused rollout from creative direction to campaign launch.",
  campaign: "Key campaign chapters arranged for fast editorial scanning.",
  thanks: "Ready to turn the brand story into a campaign people remember.",
  brief: "A concise creative direction for the team, channel, and story.",
  strategy: "The strategic choices that shape message, audience, and media.",
  style: "A visual direction built around contrast, rhythm, and red signals.",
  summary: "The core decisions to carry into production and launch.",
};

const getDefaultTitle = (cfg: MegaConfig, page: PagePlan) => {
  if (cfg.kind === "redEditorial") {
    return redEditorialDefaultTitles[page.suffix] || page.name;
  }
  return `${cfg.name} ${page.name}`;
};

const getDefaultSubtitle = (cfg: MegaConfig, page: PagePlan, groupIndex: number, pageIndex: number) => {
  if (cfg.kind === "redEditorial") {
    return redEditorialDefaultSubtitles[page.suffix] || page.description;
  }
  return subtitleTemplates[(groupIndex + pageIndex) % subtitleTemplates.length](cfg, page);
};

const getMegaSchemaDefaults = (cfg: MegaConfig, pageIndex: number): MegaSchemaDefaults => {
  if (cfg.id === "mega-004-restaurant-launch" && pageIndex === 0) {
    return {
      metrics: [
        { label: "Launch Sales", value: "84%", note: "Opening-month target" },
        { label: "Reservations", value: "72%", note: "Dinner capacity booked" },
        { label: "Avg Ticket", value: "$38", note: "Projected per guest" },
        { label: "Repeat Intent", value: "61%", note: "Local survey signal" },
      ],
      chartData: [
        { label: "Lunch", value: 48, note: "Weekday traffic" },
        { label: "Dinner", value: 86, note: "Peak reservation demand" },
        { label: "Delivery", value: 64, note: "Off-premise revenue" },
        { label: "Events", value: 58, note: "Private dining pipeline" },
        { label: "Catering", value: 42, note: "Corporate orders" },
        { label: "Loyalty", value: 73, note: "Return guest program" },
      ],
      rows: [
        { label: "Market", value: "High demand", note: "Dense local dining audience" },
        { label: "Menu", value: "Validated", note: "Hero items tested with guests" },
        { label: "Channel", value: "Multi-stream", note: "Dine-in, delivery, events" },
        { label: "Risk", value: "Controlled", note: "Launch staffing and supply plan" },
      ],
    };
  }
  if (cfg.id === "mega-006-real-estate-listing" && pageIndex === 0) {
    return {
      items: [
        { label: "Premium Listing", text: "Lead with the property's strongest lifestyle angle and location advantage." },
        { label: "Buyer Fit", text: "Frame the home for qualified buyers comparing value, finish, and neighborhood." },
        { label: "Showcase Flow", text: "Use image-led storytelling to move from curb appeal to interior proof." },
        { label: "Next Action", text: "Guide buyers toward a private tour, open house, or offer conversation." },
      ],
      metrics: [
        { label: "List Price", value: "$1.28M", note: "Premium positioning" },
        { label: "Bedrooms", value: "4", note: "Family-ready plan" },
        { label: "Living Area", value: "3,240", note: "Square feet" },
        { label: "Tour Demand", value: "76%", note: "High-intent buyer signal" },
      ],
    };
  }
  if (cfg.id === "mega-006-real-estate-listing" && pageIndex === 1) {
    return {
      metrics: [
        { label: "Buyer Demand", value: "88%", note: "Active search volume" },
        { label: "Price Strength", value: "+12%", note: "Above area median" },
        { label: "Days To Offer", value: "14", note: "Expected market window" },
        { label: "Tour Conversion", value: "41%", note: "Showing to offer intent" },
      ],
      chartData: [
        { label: "Location", value: 92, note: "Neighborhood pull" },
        { label: "Schools", value: 84, note: "Family buyer priority" },
        { label: "Finish", value: 78, note: "Move-in readiness" },
        { label: "Outdoor", value: 67, note: "Lifestyle premium" },
        { label: "Transit", value: 58, note: "Commute access" },
        { label: "Value", value: 73, note: "Comparable strength" },
      ],
      rows: [
        { label: "Position", value: "Premium", note: "Strong against nearby comps" },
        { label: "Audience", value: "Qualified buyers", note: "Families and move-up buyers" },
        { label: "Strategy", value: "Tour-led", note: "Photography, open house, private showing" },
        { label: "Timing", value: "Fast window", note: "First two weeks matter most" },
      ],
    };
  }
  return {};
};

const createMegaTemplate = (
  cfg: MegaConfig,
  page: PagePlan,
  pageIndex: number,
  groupIndex: number
) => {
  const imageUrl = cfg.id === "mega-featured-vision-mission" || cfg.kind === "redEditorial" || groupIndex === 5
    ? getImageVariant(cfg.imageUrl, `${page.suffix}-${pageIndex}`, 900, 700)
    : cfg.imageUrl;
  const pageConfig: MegaConfig = {
    ...cfg,
    id: `${cfg.id}-${page.suffix}`,
    name: `${cfg.name} ${page.name}`,
    description: `${cfg.name} ${page.name.toLowerCase()} page. ${page.description}`,
    kind: page.kind,
    imageUrl,
    curve: cfg.curve + pageIndex,
    visualMode: (cfg.visualMode + pageIndex) % 8,
  };
  const defaultTitle = getDefaultTitle(cfg, page);
  const subtitle = getDefaultSubtitle(cfg, page, groupIndex, pageIndex);
  const quote = quoteTemplates[(groupIndex + pageIndex) % quoteTemplates.length](cfg);
  const Schema = makeSchema(defaultTitle, pageConfig.imageUrl, subtitle, quote, getMegaSchemaDefaults(cfg, pageIndex));
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
    slug: slugifyTemplateName(cfg.name, index),
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
