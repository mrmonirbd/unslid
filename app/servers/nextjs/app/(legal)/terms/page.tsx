import LegalPage from "../LegalPage";

export const metadata = {
  title: "Terms",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of service"
      description="These terms describe the basic rules for using Unslid and the responsibilities that come with an account."
      sections={[
        {
          title: "Use of the service",
          body: "You are responsible for using Unslid lawfully and for ensuring that content you upload, generate, or export does not violate applicable rights or regulations.",
        },
        {
          title: "Accounts",
          body: "You are responsible for keeping your account credentials secure and for activity that occurs under your account.",
        },
        {
          title: "Generated content",
          body: "AI-generated content may require review before use. You are responsible for checking accuracy, legality, and suitability before publishing or presenting exported materials.",
        },
        {
          title: "Availability",
          body: "We work to keep the product available and reliable, but the service may change, pause, or experience interruptions.",
        },
        {
          title: "Contact",
          body: "Questions about these terms can be sent to support@yourcompany.com.",
        },
      ]}
    />
  );
}
