import LegalPage from "../LegalPage";

export const metadata = {
  title: "Subscription Policy",
};

export default function SubscriptionPolicyPage() {
  return (
    <LegalPage
      eyebrow="Subscription"
      title="Subscription policy"
      description="This policy summarizes how Unslid subscriptions, renewals, plan access, and cancellations work."
      sections={[
        {
          title: "Plans and access",
          body: "Paid plans provide access to the features, usage limits, and template availability shown at checkout or in the billing page.",
        },
        {
          title: "Billing cycle",
          body: "Subscriptions are billed according to the selected billing interval. Unless cancelled, subscriptions may renew automatically at the end of each billing period.",
        },
        {
          title: "Cancellations",
          body: "You can request cancellation from account billing settings when billing is active. Unless stated otherwise, access continues until the end of the current paid period.",
        },
        {
          title: "Plan changes",
          body: "Changing plans may update your limits, available features, and billing amount. Any prorations or credits depend on the payment processor configuration.",
        },
        {
          title: "Billing support",
          body: "For subscription questions, contact support@yourcompany.com with your account email and billing details.",
        },
      ]}
    />
  );
}
