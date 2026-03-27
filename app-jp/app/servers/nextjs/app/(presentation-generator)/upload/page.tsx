import React from "react";

import UploadPage from "./components/UploadPage";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
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
    <div className="relative">
      <Header />
      <div className="flex flex-col items-center justify-center  mb-8">
        <h1 className="text-[64px] font-normal font-unbounded text-[#101323] ">
          Unslid
        </h1>
        <p className="text-xl font-syne text-[#101323CC]">Choose a design, set preferences, and generate polished slides.</p>
      </div>

      <UploadPage />
    </div>
  );
};

export default page;
