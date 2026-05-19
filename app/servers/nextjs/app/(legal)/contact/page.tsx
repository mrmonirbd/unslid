import LegalPage from "../LegalPage";

export const metadata = {
  title: "Contact Us",
};

export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="Contact"
      title="Contact us"
      description="Need help with your account, billing, templates, or exports? Reach out and we will help you get unstuck."
      sections={[
        {
          title: "Support",
          body: "For product support, account questions, or billing help, email support@yourcompany.com with your account email and a short description of the issue.",
        },
        {
          title: "Sales and partnerships",
          body: "For team plans, partnerships, or custom template workflows, contact support@yourcompany.com and include your organization name and use case.",
        },
        {
          title: "Response time",
          body: "We aim to respond as quickly as possible during business days. Complex technical issues may require additional diagnostics or reproduction details.",
        },
      ]}
    />
  );
}
