import LegalPage from "../LegalPage";

export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="About"
      title="About Unslid"
      description="Unslid helps teams create structured, polished presentations from ideas, documents, and reusable templates."
      sections={[
        {
          title: "What we build",
          body: "We build tools for generating, editing, and exporting professional slide decks. The product combines AI-assisted outlines, template-driven layouts, custom brand kits, and PPTX/PDF export workflows.",
        },
        {
          title: "Who it is for",
          body: "Unslid is designed for founders, operators, marketers, educators, and teams that need presentation workflows to be faster without losing structure, polish, or consistency.",
        },
        {
          title: "Our approach",
          body: "Templates, themes, and reusable design systems are first-class parts of the experience. We aim to keep presentation creation practical, editable, and export-ready.",
        },
      ]}
    />
  );
}
