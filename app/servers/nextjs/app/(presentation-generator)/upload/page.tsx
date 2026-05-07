import React from "react";

import UploadPage from "./components/UploadPage";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
import DashboardSidebar from "@/app/(presentation-generator)/(dashboard)/Components/DashboardSidebar";
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
    <div className="flex min-h-screen bg-[#fbf9ff]">
      <DashboardSidebar />
      <div className="relative flex-1">
        <Header />
        <div className="mb-8 flex flex-col items-center justify-center">
          <h1 className="font-unbounded text-[64px] font-normal text-[#101323]">Unslid</h1>
          <p className="font-syne text-xl text-[#101323CC]">
            Choose a design, set preferences, and generate polished slides.
          </p>
        </div>
        <UploadPage />
      </div>
    </div>
  );
};

export default page;
