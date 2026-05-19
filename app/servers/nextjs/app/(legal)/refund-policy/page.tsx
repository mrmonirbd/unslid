import LegalPage from "../LegalPage";

export const metadata = {
  title: "Refund Policy",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      eyebrow="Refunds"
      title="Refund policy"
      description="This policy explains how refund requests are reviewed for Unslid purchases and subscriptions."
      sections={[
        {
          title: "Refund requests",
          body: "Refund requests should be sent to support@yourcompany.com with your account email, purchase date, and reason for the request.",
        },
        {
          title: "Eligibility",
          body: "Refund eligibility may depend on the purchase type, billing period, usage, applicable law, and whether the request is made within a reasonable time after purchase.",
        },
        {
          title: "Subscriptions",
          body: "Cancelling a subscription stops future renewals but does not automatically refund prior charges. Approved refunds are reviewed case by case.",
        },
        {
          title: "Processing",
          body: "Approved refunds are returned through the original payment method when possible. Payment processor timelines may vary.",
        },
        {
          title: "Questions",
          body: "If you believe a charge was made in error, contact support as soon as possible so we can investigate.",
        },
      ]}
    />
  );
}
