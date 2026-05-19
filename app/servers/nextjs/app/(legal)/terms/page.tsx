import LegalPage from "../LegalPage";

const termsSections = [
  {
    title: "1. Definitions",
    body:
      "Website means unslid.com, a web-based platform operated by Demo Company Limited, accessible through a browser on mobile devices or computers without downloading. unslid.com is a flexible digital platform offering creative tools, editors, and related services. It is not affiliated with any other company, brand, or similarly named entity. Officers means Demo Company Limited's officers, directors, employees, consultants, affiliates, subsidiaries, and agents. User means any person who registers an account on unslid.com and uses the Services. Demo Company Limited means the legal owner of unslid.com: Demo Company Limited, Company Registration Number CR-79529283, Unit 2A, 17/F Glenealy Tower No.1 Glenealy Central, Hong Kong.",
  },
  {
    title: "2. Eligibility",
    body:
      "By using the Website, you represent and warrant that you are at least eighteen (18) years old, you have not previously been suspended or removed from the Website, and your use of the Website complies with all applicable laws and regulations.",
  },
  {
    title: "3. Licence Grant to Demo Company Limited",
    body:
      "By uploading or providing information, files, or content through the Website, you authorize Demo Company Limited to process those files for the purpose of providing the Services. Demo Company Limited guarantees that files will be used solely for data-processing purposes within the Website. No third party will access your files without your additional permission.",
  },
  {
    title: "4. Infringement and Abuse",
    body:
      "Demo Company Limited is not responsible for the accuracy of materials uploaded by Users. Demo Company Limited does not verify ownership of uploaded files due to the nature of automated data processing.",
  },
  {
    title: "5. Modification, Suspension, or Termination",
    body:
      "Demo Company Limited may modify, upgrade, or discontinue the Website at any time without notice. Demo Company Limited is not liable for any changes, suspension, or termination of access to the Website.",
  },
  {
    title: "6. Third-Party Links",
    body:
      "The Website may contain links to third-party websites. We are not responsible for their content. If a User clicks a third-party link, Demo Company Limited may share the User's personal information with that third party for service-related purposes.",
  },
  {
    title: "7. Ownership and Intellectual Property",
    body:
      "All visual interfaces, graphics, designs, data, software, code, and other materials on the Website are protected by intellectual property laws and are the property of Demo Company Limited or its licensors. If third-party intellectual property appears on the Website without proper licensing, the rightful owner may request removal under the DMCA or EUCD. Demo Company Limited does not claim ownership of third-party trademarks or intellectual property. Users may not use Website materials unless expressly authorized in writing. All rights not expressly granted are reserved.",
  },
  {
    title: "8. Prohibited Uses",
    body:
      "Users may not use the Website for unlawful purposes, damage or disrupt the Website or its servers, upload viruses or harmful code, circumvent Website limitations or API restrictions, attempt unauthorized access to systems or accounts, or violate applicable laws including export controls and intellectual property laws.",
  },
  {
    title: "9. Indemnity",
    body:
      "You agree to indemnify and hold harmless Demo Company Limited and its Officers from any claims arising from your use or misuse of the Website, your violation of these Terms, your violation of third-party rights, or disputes between you and third parties. Demo Company Limited may assume exclusive defense of any matter subject to indemnification.",
  },
  {
    title: "10. Disclaimers and No Warranties",
    body:
      "You use the Website at your own risk. The Website is provided as is without warranties of any kind, express or implied. Demo Company Limited does not provide physical products.",
  },
  {
    title: "11. Limitation of Liability",
    body:
      "Demo Company Limited is not liable for direct, indirect, incidental, or consequential damages; losses arising from Website access or inability to access; third-party services or advertisements; or losses resulting from User-shared login credentials.",
  },
  {
    title: "12. Governing Law",
    body:
      "These Terms are governed by the laws of Hong Kong SAR. Any disputes shall be resolved exclusively in the courts of Hong Kong.",
  },
  {
    title: "13. Changes to Terms",
    body:
      "Demo Company Limited may modify these Terms at any time. Updated versions will be posted on the Website. Continued use of the Website constitutes acceptance of the revised Terms.",
  },
  {
    title: "14. General Provisions",
    body:
      "These Terms and the Privacy Policy constitute the entire agreement. Section headers are for convenience only. Users may not assign their rights without written consent. Demo Company Limited may assign these Terms without notice. If any provision is invalid, the remainder remains enforceable. The Website is not intended to ensure GDPR or CCPA compliance for Users.",
  },
  {
    title: "15. Communications",
    body:
      "All communication with Demo Company Limited is electronic. Users consent to receive electronic communications and may receive newsletters if subscribed. Notifications may be delivered through the Website or email. The Website does not provide support services unless explicitly stated.",
  },
  {
    title: "16. Market Terms",
    body:
      "Demo Company Limited grants Users a limited, non-exclusive, non-transferable license to use the Website on their devices. Users may not copy or modify the Website, distribute or sublicense their account, reverse engineer the Website, or make the Website available to multiple users.",
  },
  {
    title: "17. User Accounts",
    body:
      "Users may register via email, Google, or Facebook. Users are responsible for all activity under their account. Demo Company Limited may terminate accounts or remove content at its discretion. Demo Company Limited may access any information stored on the Website.",
  },
  {
    title: "18. Subscription and Payment Terms",
    body:
      "Pricing differs depending on the country. You are responsible for ensuring that the price you pay matches the country in which you registered your account. If you think you have been charged the wrong amount, contact support@unslid.com. Subscription, Paid Membership, and Membership refer to any paid access plans provided by Demo Company Limited for unslid.com. You may buy a paid Subscription to unlock premium features and services. Each Subscription gives access only to the selected plan. Many plans include an initial trial period, typically charged at a reduced rate of EUR 3. Prices, trial fees, taxes, offers, regional differences, and trial periods are shown on the Website at purchase. Listed prices include applicable local taxes unless otherwise indicated. Prices can differ based on location, Subscription length, promotions, included features, or billing cycle. We may change Subscription fees or introduce new charges at any time, with advance notice where legally required. If you do not accept a price change, you may cancel your Subscription.",
  },
  {
    title: "18.4 Payments and Billing",
    body:
      "Payments are handled securely through credit or debit cards, including Visa and MasterCard. We do not keep your card information on file. Transactions are protected by SSL encryption and processed by reputable third-party payment providers. Subscriptions, including trials, are charged in advance and renew automatically according to the billing cycle selected. By purchasing a Subscription, you authorize us to charge your payment method for every renewal. You must ensure sufficient funds or credit. If payment is declined, we may suspend access until resolved. You will receive a confirmation email after successful payment. Charges on your bank or card statement will show as related to unslid.com. We may use third-party services for invoicing or payment processing, including factoring arrangements where appropriate.",
  },
  {
    title: "18.5 Auto-Renewal and Automatic Payments",
    body:
      "At the end of the trial period, if applicable, or at the end of each billing cycle, your Subscription will automatically renew and convert to the full paid plan you selected at the prevailing rate, excluding introductory promotional discounts or trial-period charges. You can stop automatic renewals by adjusting account settings or contacting us using the cancellation methods in these Terms. Deleting your account, uninstalling any app, or stopping use of the service will not cancel your Subscription or stop future charges. If you dispute a charge or request a chargeback outside the situations allowed by these Terms, we may suspend or terminate your account and no refund will be issued for the period in question.",
  },
  {
    title: "19. Cancellation and Refunds",
    body:
      "You may cancel your Subscription at any time and for any reason without penalty. To cancel, log into your account and select the Cancel Subscription option, email support@unslid.com with your full name, registered email address, username, and cancellation request, submit a message through the Contact Page, call +852 2319 4155, use the Cancel Subscription section in the footer, or submit a support ticket through the live chat box. Cancellation takes effect at the end of the current paid period, and you may continue to use the service until then. No prorated refunds will be given unless expressly stated in the Refund Policy.",
  },
  {
    title: "19.2 Refund Policy",
    body:
      "We provide a 100% money-back guarantee if you cancel your Subscription within 14 days from the date of your initial purchase, including charges made during a trial period. To request a refund, email support@unslid.com with your order details. Refund requests after the 14-day period are reviewed case by case and are not guaranteed. We do not issue refunds for partial periods, accounts terminated due to violations, or chargebacks made contrary to these Terms. You can view your Subscription status, next renewal date, and billing history in your account dashboard. Please also check the Refund Policy section for the most up-to-date information.",
  },
  {
    title: "20. Anti-Money Laundering Policy",
    body:
      "Demo Company Limited prohibits bribery, corruption, and money laundering. Users must comply with all applicable anti-corruption and anti-money laundering laws. Non-compliance may result in immediate account termination.",
  },
  {
    title: "21. Other Conditions",
    body:
      "If special terms apply to certain features, those terms prevail. If you do not agree to these Terms, you must stop using the Website. Continued use constitutes acceptance of all conditions.",
  },
  {
    title: "Contact Information",
    body:
      "Demo Company Limited. Official Email: support@unslid.com. Website: unslid.com. Legal Address: Demo Address.  Official Phone Number: +123456789. Date of Terms: 2026-05-19.",
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms & Conditions"
      description="Please read these Terms carefully as they affect your legal rights. These Terms, together with the Privacy Policy of Demo Company Limited, govern your use of unslid.com."
      updatedAt="2026-01-19"
      sections={termsSections}
    />
  );
}
