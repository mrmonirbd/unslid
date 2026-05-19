import React from "react";

import UploadPage from "./components/UploadPage";
import DashboardSidebar from "@/app/(presentation-generator)/(dashboard)/Components/DashboardSidebar";
import CommonFooter from "@/components/CommonFooter";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create a Presentation | Unslid",
  description:
    "Create professional AI-powered presentations in minutes. Multi-model support (OpenAI, Gemini, Claude), beautiful templates, and PDF/PPTX export.",
  alternates: {
    canonical: "https://app.unslid.com/create",
  },
  keywords: [
    "AI presentation generator",
    "AI presentations",
    "automatic presentation maker",
    "professional slides",
    "document to presentation",
    "presentation automation",
    "business presentations",
    "PPTX generator",
    "PDF export",
    "Gamma alternative",
  ],
  openGraph: {
    title: "Create a Presentation | Unslid",
    description:
      "Create professional AI-powered presentations in minutes. Multi-model support, beautiful templates, PPTX & PDF export.",
    type: "website",
    url: "https://app.unslid.com/create",
    siteName: "Unslid",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create a Presentation | Unslid",
    description:
      "Create professional AI-powered presentations in minutes. Multi-model support, beautiful templates, PPTX & PDF export.",
    site: "@unslid",
    creator: "@unslid",
  },
};

const page = () => {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#fbf9ff] text-slate-950 md:flex-row">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_32%),linear-gradient(180deg,#fbf9ff_0%,#ffffff_48%,#f8fafc_100%)] md:h-screen">
        <UploadPage />
        <CommonFooter />
      </div>
      <DashboardSidebar />
    </div>
  );
};

export default page;
