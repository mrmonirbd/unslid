import type { MetadataRoute } from "next";

const siteUrl = "https://app.unslid.com";

const publicRoutes = [
  "",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/subscription-policy",
  "/pdf-maker",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
