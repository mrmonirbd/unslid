import LegalPage from "../LegalPage";

export const metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy policy"
      description="This page explains the kinds of information used to provide the Unslid service and how that information is handled."
      sections={[
        {
          title: "Information we collect",
          body: "We may collect account details, uploaded files, generated presentations, usage activity, billing metadata, and settings needed to operate the product.",
        },
        {
          title: "How information is used",
          body: "Information is used to authenticate users, generate presentations, process uploads, provide exports, support billing, improve reliability, and respond to support requests.",
        },
        {
          title: "Uploaded content",
          body: "Uploaded documents and generated assets are processed to create presentation content and previews. Access is scoped to the authenticated workspace whenever private assets are served.",
        },
        {
          title: "Data security",
          body: "We use reasonable technical and organizational safeguards to protect account and workspace data. No online service can guarantee absolute security.",
        },
        {
          title: "Contact",
          body: "For privacy questions or account data requests, contact support@yourcompany.com.",
        },
      ]}
    />
  );
}
