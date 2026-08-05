

export const FONT_OPTIONS: any[] = [
  { name: 'Inter', displayName: 'Inter', cssUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap' },
  { name: 'DM Sans', displayName: 'DM Sans', cssUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap' },
  { name: 'Overpass', displayName: 'Overpass', cssUrl: 'https://fonts.googleapis.com/css2?family=Overpass:wght@100..900&display=swap' },
  { name: 'Barlow', displayName: 'Barlow', cssUrl: 'https://fonts.googleapis.com/css2?family=Barlow:wght@100..900&display=swap' },
  { name: 'Nunito', displayName: 'Nunito', cssUrl: 'https://fonts.googleapis.com/css2?family=Nunito:wght@200..1000&display=swap' },
  { name: 'Lora', displayName: 'Lora', cssUrl: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap' },
  { name: 'Instrument Sans', displayName: 'Instrument Sans', cssUrl: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap' },
  { name: 'Roboto Slab', displayName: 'Roboto Slab', cssUrl: 'https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@100..900&display=swap' },
  { name: 'Montserrat', displayName: 'Montserrat', cssUrl: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&display=swap' },
  { name: 'Libre Baskerville', displayName: 'Libre Baskerville', cssUrl: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap' },
  { name: 'Prompt', displayName: 'Prompt', cssUrl: 'https://fonts.googleapis.com/css2?family=Prompt:wght@100..900&display=swap' },
  { name: 'Inconsolata', displayName: 'Inconsolata', cssUrl: 'https://fonts.googleapis.com/css2?family=Inconsolata:wght@200..900&display=swap' },
  { name: 'Fraunces', displayName: 'Fraunces', cssUrl: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@300..900&display=swap' },
  { name: 'Gelasio', displayName: 'Gelasio', cssUrl: 'https://fonts.googleapis.com/css2?family=Gelasio:wght@300..700&display=swap' },
  { name: 'Raleway', displayName: 'Raleway', cssUrl: 'https://fonts.googleapis.com/css2?family=Raleway:wght@100..900&display=swap' },
  { name: 'Kanit', displayName: 'Kanit', cssUrl: 'https://fonts.googleapis.com/css2?family=Kanit:wght@100..900&display=swap' },
  { name: 'Corben', displayName: 'Corben', cssUrl: 'https://fonts.googleapis.com/css2?family=Corben:wght@400;700&display=swap' },
  { name: 'Poppins', displayName: 'Poppins', cssUrl: 'https://fonts.googleapis.com/css2?family=Poppins:wght@100..900&display=swap' },
  { name: 'Open Sans', displayName: 'Open Sans', cssUrl: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300..800&display=swap' },
  { name: 'Lato', displayName: 'Lato', cssUrl: 'https://fonts.googleapis.com/css2?family=Lato:wght@100..900&display=swap' },
  { name: 'Source Sans Pro', displayName: 'Source Sans Pro', cssUrl: 'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@200..900&display=swap' },
  { name: 'Playfair Display', displayName: 'Playfair Display', cssUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap' },
  { name: 'Roboto', displayName: 'Roboto', cssUrl: 'https://fonts.googleapis.com/css2?family=Roboto:wght@100..900&display=swap' }
]

const GENERATED_THEME_TARGET = 210;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((normalizedHue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    normalizedHue < 60 ? [c, x, 0] :
    normalizedHue < 120 ? [x, c, 0] :
    normalizedHue < 180 ? [0, c, x] :
    normalizedHue < 240 ? [0, x, c] :
    normalizedHue < 300 ? [x, 0, c] :
    [c, 0, x];

  const toHex = (value: number) =>
    Math.round((value + m) * 255).toString(16).padStart(2, "0");

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
};

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

const mixHex = (from: string, to: string, weight = 0.5) => {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const mix = (left: number, right: number) =>
    Math.round(left * (1 - weight) + right * weight).toString(16).padStart(2, "0");
  return `#${mix(a.r, b.r)}${mix(a.g, b.g)}${mix(a.b, b.b)}`;
};

const getRelativeLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const readableText = (hex: string) =>
  getRelativeLuminance(hex) > 0.52 ? "#111827" : "#ffffff";

const themeNameWords = [
  "Prism", "Vector", "Lumen", "Pulse", "Summit", "Orbit", "Signal", "Bloom", "Atlas", "Nova",
  "Lucid", "Kinetic", "Frame", "Aster", "Vertex", "Cipher", "Quartz", "Flux", "Studio", "Halo",
];

const makeGraphColors = (hue: number, dark: boolean) =>
  Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [
      `graph_${index}`,
      hslToHex(
        hue + index * 27 + (index % 2 ? 18 : 0),
        clamp(78 - index * 3, 42, 84),
        dark ? clamp(66 - index * 4, 32, 70) : clamp(42 + index * 4, 38, 78)
      ),
    ])
  );

const createGeneratedTheme = (index: number) => {
  const hue = (index * 137.508 + 19) % 360;
  const mode = index % 12;
  const dark = mode === 2 || mode === 5 || mode === 8 || mode === 11;

  const palettes = [
    {
      primary: hslToHex(hue, 78, 42),
      background: hslToHex(hue + 26, 48, 98),
      card: hslToHex(hue, 76, 92),
      stroke: hslToHex(hue, 32, 82),
    },
    {
      primary: hslToHex(hue + 12, 86, 38),
      background: hslToHex(hue + 178, 42, 96),
      card: hslToHex(hue + 24, 80, 88),
      stroke: hslToHex(hue + 24, 36, 78),
    },
    {
      primary: hslToHex(hue, 84, 62),
      background: hslToHex(hue + 220, 42, 9),
      card: hslToHex(hue + 20, 54, 20),
      stroke: hslToHex(hue + 20, 34, 30),
    },
    {
      primary: hslToHex(hue + 180, 82, 46),
      background: hslToHex(hue, 30, 97),
      card: hslToHex(hue + 180, 58, 90),
      stroke: hslToHex(hue + 180, 35, 78),
    },
    {
      primary: hslToHex(hue + 290, 75, 47),
      background: hslToHex(hue + 20, 72, 97),
      card: hslToHex(hue + 28, 80, 89),
      stroke: hslToHex(hue + 28, 38, 77),
    },
    {
      primary: hslToHex(hue + 82, 92, 55),
      background: hslToHex(hue + 245, 44, 8),
      card: hslToHex(hue + 252, 48, 18),
      stroke: hslToHex(hue + 252, 36, 29),
    },
    {
      primary: hslToHex(hue + 18, 88, 50),
      background: hslToHex(hue + 62, 52, 94),
      card: hslToHex(hue + 112, 56, 86),
      stroke: hslToHex(hue + 112, 36, 74),
    },
    {
      primary: hslToHex(hue + 315, 78, 43),
      background: hslToHex(hue + 315, 40, 96),
      card: hslToHex(hue + 5, 70, 90),
      stroke: hslToHex(hue + 5, 34, 78),
    },
    {
      primary: hslToHex(hue + 130, 88, 59),
      background: hslToHex(hue + 230, 46, 10),
      card: hslToHex(hue + 190, 48, 22),
      stroke: hslToHex(hue + 190, 34, 34),
    },
    {
      primary: hslToHex(hue + 215, 82, 44),
      background: hslToHex(hue + 15, 36, 98),
      card: hslToHex(hue + 210, 64, 90),
      stroke: hslToHex(hue + 210, 34, 78),
    },
    {
      primary: hslToHex(hue + 34, 82, 47),
      background: hslToHex(hue + 88, 44, 95),
      card: hslToHex(hue + 54, 76, 88),
      stroke: hslToHex(hue + 54, 36, 76),
    },
    {
      primary: hslToHex(hue + 265, 88, 64),
      background: hslToHex(hue + 214, 38, 11),
      card: hslToHex(hue + 260, 45, 22),
      stroke: hslToHex(hue + 260, 34, 34),
    },
  ];

  const palette = palettes[mode];
  const graphColors = makeGraphColors(hue + 12, dark);
  const font = FONT_OPTIONS[(index * 7 + mode) % FONT_OPTIONS.length];

  return {
    id: `generated-palette-${String(index + 1).padStart(3, "0")}`,
    name: `${themeNameWords[index % themeNameWords.length]} ${String(index + 1).padStart(3, "0")}`,
    description: "Generated color template with a distinct accent, surface, chart scale, and readable text pairing.",
    logo: null,
    logo_url: null,
    company_name: null,
    data: {
      colors: {
        primary: palette.primary,
        background: palette.background,
        card: mixHex(palette.card, palette.background, mode % 2 ? 0.18 : 0.08),
        stroke: palette.stroke,
        primary_text: readableText(palette.primary),
        background_text: readableText(palette.background),
        ...graphColors,
      },
      fonts: {
        textFont: {
          name: font.name,
          url: font.cssUrl,
        }
      }
    }
  };
};

const CURATED_DEFAULT_THEMES: any[] = [
  {
    id: "edge-yellow",
    name: "Edge Yellow",
    description: "Yellow and dark theme for professionalish and edge.",
    logo: null,
    logo_url: null,
    company_name: null,

    data: {
      colors: {
        primary: "#f5f547",
        background: "#1f1f1f",
        card: "#424242",
        stroke: "#585858",
        primary_text: "#161616",
        background_text: "#f5f547",
        graph_0: "#ffff54",
        graph_1: "#f1f142",
        graph_2: "#dada15",
        graph_3: "#c1bf00",
        graph_4: "#a8a600",
        graph_5: "#908c00",
        graph_6: "#797400",
        graph_7: "#625c00",
        graph_8: "#4d4500",
        graph_9: "#382f00"
      },
      fonts: {
        textFont: {
          name: "Playfair Display",
          url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..900&display=swap"
        }
      }
    }
  },
  {
    id: "light-rose",
    name: "Light Rose",
    description: "Rose background with punchy font",
    logo: null,
    logo_url: null,
    company_name: null,

    data: {
      colors: {
        "primary": "#030204",
        background: "#f69c9c",
        card: "#ffaeb4",
        stroke: "#bf6a6b",
        primary_text: "#bebebe",
        background_text: "#030202",
        graph_0: "#2f2c32",
        graph_1: "#444147",
        graph_2: "#5a565d",
        graph_3: "#706d73",
        graph_4: "#88848b",
        graph_5: "#a09da4",
        graph_6: "#b9b6bd",
        graph_7: "#d3cfd6",
        graph_8: "#eae6ed",
        graph_9: "#f7f3fb"
      },
      fonts: {
        textFont: {
          name: "Overpass",
          url: "https://fonts.googleapis.com/css2?family=Overpass:wght@100..900&display=swap"
        }
      }
    }
  },
  {
    id: "mint-blue",
    name: "Mint Blue",
    description: "Mint Greent with blue heading.",
    logo: null,
    logo_url: null,
    company_name: null,

    data: {
      colors: {
        primary: "#3b3172",
        background: "#ffffff",
        card: "#80e7cf",
        stroke: "#d1d1d1",
        primary_text: "#ffffff",
        background_text: "#3b3172",
        graph_0: "#003d2d",
        graph_1: "#005341",
        graph_2: "#006a57",
        graph_3: "#00826d",
        graph_4: "#2b9a85",
        graph_5: "#4ab39d",
        graph_6: "#65cdb6",
        graph_7: "#80e7cf",
        graph_8: "#98ffe6",
        graph_9: "#a5fff4"
      },
      fonts: {
        textFont: {
          name: "Prompt",
          url: "https://fonts.googleapis.com/css2?family=Prompt:wght@100..900&display=swap"
        }
      }
    }
  },
  {
    id: "professional-blue",
    name: "Professional Blue",
    description: "Clean and professional blue theme",
    logo: null,
    logo_url: null,
    company_name: null,

    data: {
      colors: {
        primary: "#161616",
        background: "#ffffff",
        card: "#dae6ff",
        stroke: "#d1d1d1",
        primary_text: "#eeeaea",
        background_text: "#000000",
        graph_0: "#2e2e2e",
        graph_1: "#424242",
        graph_2: "#585858",
        graph_3: "#6f6f6f",
        graph_4: "#868686",
        graph_5: "#9e9e9e",
        graph_6: "#b7b7b7",
        graph_7: "#d1d1d1",
        graph_8: "#e8e8e8",
        graph_9: "#f5f5f5"
      },
      fonts: {
        textFont: {
          name: "Inter",
          url: "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"
        }
      }
    }
  },
  {
    id: "professional-dark",
    name: "Professional Dark",
    description: "Clean and professional for dark corporate usage.",
    logo: null,
    logo_url: null,
    company_name: null,

    data: {
      colors: {
        primary: "#eff5f1",
        background: "#050505",
        card: "#424242",
        stroke: "#585858",
        primary_text: "#050505",
        background_text: "#eff5f1",
        graph_0: "#ebf6ff",
        graph_1: "#dee8fa",
        graph_2: "#c7d2e3",
        graph_3: "#aeb8c9",
        graph_4: "#959fb0",
        graph_5: "#7d8797",
        graph_6: "#666f7f",
        graph_7: "#505867",
        graph_8: "#3a4351",
        graph_9: "#262e3c"
      },
      fonts: {
        textFont: {
          name: "Instrument Sans",
          url: "https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap"
        }
      }
    }
  }
]

export const GENERATED_COLOR_THEMES: any[] = Array.from(
  { length: GENERATED_THEME_TARGET - CURATED_DEFAULT_THEMES.length },
  (_, index) => createGeneratedTheme(index)
);

export const DEFAULT_THEMES: any[] = [
  ...CURATED_DEFAULT_THEMES,
  ...GENERATED_COLOR_THEMES,
];
