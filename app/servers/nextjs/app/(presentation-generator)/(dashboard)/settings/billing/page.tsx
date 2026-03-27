"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api, BillingStatus } from "@/lib/api";
import { Check, AlertTriangle, Download, CreditCard as CardIcon, ExternalLink, Zap, Clock } from "lucide-react";

interface PlanPricingEntry {
  price_monthly: number;
  price_annual: number;
  currency: string;
  stripe_price_id_monthly: string;
  stripe_price_id_annual: string;
  features: string[];
}

interface TrialConfig {
  name: string;
  days: number;
  price: number;
  currency: string;
  stripe_price_id: string;
  features: string[];
}

interface Invoice {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  pdf_url: string | null;
  hosted_url: string | null;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface BillingStatusExtended extends BillingStatus {
  plan_pricing?: {
    free: PlanPricingEntry;
    pro: PlanPricingEntry;
    team: PlanPricingEntry;
  };
  trial_config?: TrialConfig;
  trial_expires_at?: string | null;
  trial_days_remaining?: number | null;
  subscription_status?: string;
  cancel_at_period_end?: boolean;
  subscription_ends_at?: string | null;
}

const PLAN_LABELS: Record<string, string> = { free: "Free", pro: "Pro", team: "Team" };
const PLAN_COLORS: Record<string, { border: string; button: string; badge: string }> = {
  free: { border: "border-slate-200", button: "bg-slate-700 hover:bg-slate-600", badge: "bg-slate-100 text-slate-700" },
  pro:  { border: "border-indigo-300", button: "bg-indigo-600 hover:bg-indigo-500", badge: "bg-indigo-100 text-indigo-700" },
  team: { border: "border-purple-300", button: "bg-purple-600 hover:bg-purple-500", badge: "bg-purple-100 text-purple-700" },
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const cancelled = searchParams.get("cancelled");
  const trialSuccess = searchParams.get("trial_success");

  const [status, setStatus] = useState<BillingStatusExtended | null>(null);
  const [loading, setLoading] = useState(true);
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    api.get<BillingStatusExtended>("/api/v1/billing/status").then((s) => {
      setStatus(s);
      if (s.has_billing) {
        api.get<Invoice[]>("/api/v1/billing/invoices").then(setInvoices).catch(() => {});
        api.get<PaymentMethod | null>("/api/v1/billing/payment-method").then((pm) => {
          if (pm) setPaymentMethod(pm);
        }).catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleTrialCheckout = async () => {
    setCheckoutLoading("trial");
    try {
      const { url } = await api.post<{ url: string }>("/api/v1/billing/checkout/trial");
      window.location.href = url;
    } catch (err: any) {
      alert(err?.message || "Could not start trial checkout. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleCheckout = async (priceId: string, planKey: string) => {
    if (!priceId) {
      alert("Billing is not configured yet. Please contact support or check back soon.");
      return;
    }
    setCheckoutLoading(planKey);
    try {
      const { url } = await api.post<{ url: string }>("/api/v1/billing/checkout", { price_id: priceId });
      window.location.href = url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await api.post<{ url: string }>("/api/v1/billing/portal");
      window.location.href = url;
    } catch {
      alert("Could not open billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const formatPrice = (entry: PlanPricingEntry) => {
    if (entry.price_monthly === 0) return "Free";
    const price = cadence === "monthly" ? entry.price_monthly : Math.round(entry.price_annual / 12 * 100) / 100;
    return `$${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}`;
  };

  const annualSaving = (entry: PlanPricingEntry) => {
    if (!entry.price_monthly || !entry.price_annual) return 0;
    return Math.round((1 - entry.price_annual / (entry.price_monthly * 12)) * 100);
  };

  if (loading) return <div className="p-8 text-slate-500 text-sm">Loading…</div>;

  const pricing = status?.plan_pricing;
  const currentPlan = status?.plan ?? "free";

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Billing</h1>

      {trialSuccess && status?.trial_days_remaining != null && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-sm font-medium flex items-center gap-3">
          <Zap className="h-5 w-5 text-amber-500 shrink-0" />
          <span>
            <strong>{status.trial_config?.name ?? "Spark"} activated!</strong> You have{" "}
            <strong>{status.trial_days_remaining} days</strong> of full Pro access. Enjoy — and upgrade to Pro before it expires to keep everything.
          </span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-xl text-green-800 text-sm font-medium flex items-center gap-2">
          <Check className="h-4 w-4" /> Your subscription is now active. Welcome to the {PLAN_LABELS[currentPlan]} plan!
        </div>
      )}
      {cancelled && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          Checkout was cancelled. Your plan has not been changed.
        </div>
      )}
      {status?.subscription_status === "past_due" && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-xl text-red-800 text-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Payment failed — action required</p>
            <p className="mt-0.5">Your last payment could not be processed. Please update your payment method to avoid losing access to your plan.</p>
            <button onClick={handlePortal} className="mt-2 underline font-medium">Update payment method →</button>
          </div>
        </div>
      )}
      {status?.cancel_at_period_end && status.subscription_ends_at && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Subscription ending</p>
            <p className="mt-0.5">
              Your subscription will end on{" "}
              <strong>{new Date(status.subscription_ends_at).toLocaleDateString()}</strong>. After that, your account will move to the free plan.
            </p>
            <button onClick={handlePortal} className="mt-2 underline font-medium">Reactivate →</button>
          </div>
        </div>
      )}

      {/* Trial countdown banner — shown when user is on an active Spark trial */}
      {status?.trial_expires_at && status.trial_days_remaining != null && (
        <div className={`p-4 border rounded-xl text-sm flex items-start gap-3 ${
          status.trial_days_remaining <= 1
            ? "bg-red-50 border-red-300 text-red-800"
            : "bg-amber-50 border-amber-300 text-amber-800"
        }`}>
          <Clock className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">
              {status.trial_config?.name ?? "Spark"} trial —{" "}
              {status.trial_days_remaining === 0
                ? "expires today"
                : `${status.trial_days_remaining} day${status.trial_days_remaining === 1 ? "" : "s"} remaining`}
            </p>
            <p className="mt-0.5">
              Your trial expires on{" "}
              <strong>{new Date(status.trial_expires_at).toLocaleDateString()}</strong>.
              Upgrade to Pro to keep your access and presentations without interruption.
            </p>
          </div>
        </div>
      )}

      {/* Current plan */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Current plan</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${PLAN_COLORS[currentPlan]?.badge}`}>
              {PLAN_LABELS[currentPlan] ?? currentPlan}
            </span>
            {currentPlan === "free" && (
              <span className="text-sm text-slate-500">Free forever</span>
            )}
          </div>
          {status?.has_billing && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
            >
              {portalLoading ? "Loading…" : "Manage subscription"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Presentations this month</p>
            <p className="text-lg font-semibold text-slate-800 mt-0.5">
              {status?.usage.presentations_this_month ?? 0}
              {status?.usage.monthly_limit != null
                ? <span className="text-sm text-slate-400"> / {status.usage.monthly_limit}</span>
                : <span className="text-sm text-slate-400"> / ∞</span>
              }
            </p>
            {status?.usage.monthly_limit != null && (
              <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((status.usage.presentations_this_month ?? 0) / status.usage.monthly_limit) * 100)}%` }}
                />
              </div>
            )}
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Storage used</p>
            <p className="text-lg font-semibold text-slate-800 mt-0.5">
              {formatBytes(status?.storage_used_bytes ?? 0)}
            </p>
          </div>
        </div>
      </section>

      {/* Plan cards */}
      {currentPlan === "free" && pricing && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Upgrade your plan</h2>

            {/* Monthly / Annual toggle */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setCadence("monthly")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${cadence === "monthly" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setCadence("annual")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${cadence === "annual" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}
              >
                Annual
                {annualSaving(pricing.pro) > 0 && (
                  <span className="ml-1.5 text-green-600">−{annualSaving(pricing.pro)}%</span>
                )}
              </button>
            </div>
          </div>

          {/* Spark trial card — only shown when Stripe is configured */}
          {status?.trial_config && status.trial_config.stripe_price_id && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 space-y-5 relative">
              <span className="absolute -top-3 right-4 text-xs bg-amber-500 text-white font-semibold px-3 py-0.5 rounded-full shadow">
                Try before you subscribe
              </span>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold mb-2 bg-amber-100 text-amber-700">
                  <Zap className="w-3 h-3" /> {status.trial_config.name}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">
                    ${status.trial_config.price % 1 === 0
                      ? status.trial_config.price.toFixed(0)
                      : status.trial_config.price.toFixed(2)}
                  </span>
                  <span className="text-slate-500 text-sm mb-1">one-time</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {status.trial_config.days} days of full Pro access — no subscription
                </p>
              </div>

              <ul className="space-y-2">
                {status.trial_config.features.filter(Boolean).map((f) => (
                  <li key={f} className="text-sm text-slate-600 flex items-start gap-2">
                    <Check className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleTrialCheckout}
                disabled={checkoutLoading === "trial"}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {checkoutLoading === "trial" ? "Redirecting…" : `Get ${status.trial_config.name} Access — $${status.trial_config.price % 1 === 0 ? status.trial_config.price.toFixed(0) : status.trial_config.price.toFixed(2)}`}
              </button>
              <p className="text-center text-xs text-slate-400">
                One-time payment. Automatically expires after {status.trial_config.days} days. No subscription required.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(["pro", "team"] as const).map((planKey) => {
              const entry = pricing[planKey];
              const priceId = cadence === "monthly"
                ? (entry.stripe_price_id_monthly || status?.prices[`${planKey}_monthly`] || "")
                : (entry.stripe_price_id_annual  || status?.prices[`${planKey}_annual`]  || "");
              const saving = annualSaving(entry);

              return (
                <div
                  key={planKey}
                  className={`bg-white border-2 ${PLAN_COLORS[planKey].border} rounded-xl p-6 space-y-5 relative`}
                >
                  {planKey === "pro" && (
                    <span className="absolute -top-3 right-4 text-xs bg-indigo-600 text-white font-semibold px-3 py-0.5 rounded-full shadow">
                      Most popular
                    </span>
                  )}

                  <div>
                    <div className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold mb-2 ${PLAN_COLORS[planKey].badge}`}>
                      {PLAN_LABELS[planKey]}
                    </div>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold text-slate-900">{formatPrice(entry)}</span>
                      {entry.price_monthly > 0 && (
                        <span className="text-slate-500 text-sm mb-1">/mo</span>
                      )}
                    </div>
                    {cadence === "annual" && entry.price_annual > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Billed annually (${entry.price_annual}/yr)
                        {saving > 0 && <span className="ml-1 text-green-600 font-semibold">· Save {saving}%</span>}
                      </p>
                    )}
                    {cadence === "monthly" && entry.price_annual > 0 && saving > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">Switch to annual to save {saving}%</p>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {entry.features.filter(Boolean).map((f) => (
                      <li key={f} className="text-sm text-slate-600 flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCheckout(priceId, planKey)}
                    disabled={checkoutLoading === planKey}
                    className={`w-full py-2.5 ${PLAN_COLORS[planKey].button} disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition`}
                  >
                    {checkoutLoading === planKey
                      ? "Redirecting…"
                      : priceId
                        ? `Upgrade to ${PLAN_LABELS[planKey]}`
                        : `Upgrade to ${PLAN_LABELS[planKey]} (contact us)`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pro → Team upgrade CTA */}
      {currentPlan === "pro" && pricing && (
        <section className="bg-purple-50 border border-purple-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-purple-800">Ready to collaborate?</h2>
          <p className="text-sm text-purple-700">
            Upgrade to the <strong>Team plan</strong> to invite colleagues, share presentations, and collaborate. You&apos;ll keep all your existing files with new team sharing controls.
          </p>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-purple-600">Team plan starts at</p>
              <p className="text-2xl font-bold text-purple-900">
                ${pricing.team.price_monthly}/mo <span className="text-sm font-normal">per seat</span>
              </p>
              <p className="text-xs text-purple-500">Minimum 2 seats</p>
            </div>
            <button
              onClick={() => {
                const priceId = cadence === "monthly"
                  ? (pricing.team.stripe_price_id_monthly || status?.prices["team_monthly"] || "")
                  : (pricing.team.stripe_price_id_annual  || status?.prices["team_annual"]  || "");
                handleCheckout(priceId, "team");
              }}
              disabled={checkoutLoading === "team"}
              className="ml-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition"
            >
              {checkoutLoading === "team" ? "Redirecting…" : "Upgrade to Team →"}
            </button>
          </div>
          <p className="text-xs text-purple-500">Your Pro subscription will be cancelled and replaced. Pro-rated credit will be applied.</p>
        </section>
      )}

      {/* Already on paid plan — show what's included */}
      {currentPlan !== "free" && pricing && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-slate-800">What&apos;s included in your plan</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {pricing[currentPlan as "pro" | "team"]?.features.filter(Boolean).map((f) => (
              <li key={f} className="text-sm text-slate-600 flex items-start gap-2">
                <Check className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          {status?.has_billing && (
            <p className="text-xs text-slate-400 pt-2">
              Manage or cancel your subscription via the{" "}
              <button onClick={handlePortal} className="underline text-indigo-500">billing portal</button>.
            </p>
          )}
        </section>
      )}

      {/* Payment method */}
      {status?.has_billing && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <CardIcon className="h-4 w-4 text-slate-500" />
              Payment method
            </h2>
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="text-sm text-indigo-600 hover:text-indigo-800 underline disabled:opacity-50"
            >
              {portalLoading ? "Loading…" : "Change method →"}
            </button>
          </div>
          {paymentMethod ? (
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <CardIcon className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-800 capitalize">
                  {paymentMethod.brand} ending in {paymentMethod.last4}
                </p>
                <p className="text-xs text-slate-500">
                  Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}
                  {paymentMethod.exp_year < new Date().getFullYear() ||
                  (paymentMethod.exp_year === new Date().getFullYear() &&
                    paymentMethod.exp_month < new Date().getMonth() + 1) ? (
                    <span className="ml-2 text-red-500 font-semibold">Expired</span>
                  ) : null}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No payment method on file.</p>
          )}
        </section>
      )}

      {/* Invoice history */}
      {invoices.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-slate-800">Invoice history</h2>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left py-2 px-2 font-medium">Date</th>
                  <th className="text-left py-2 px-2 font-medium">Description</th>
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                  <th className="text-center py-2 px-2 font-medium">Status</th>
                  <th className="text-center py-2 px-2 font-medium">Download</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                    <td className="py-3 px-2 text-slate-600">
                      {new Date(inv.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-3 px-2 text-slate-700 max-w-[180px] truncate">{inv.description}</td>
                    <td className="py-3 px-2 text-right font-medium text-slate-800">
                      ${inv.amount.toFixed(2)} {inv.currency}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        inv.status === "paid"
                          ? "bg-green-100 text-green-700"
                          : inv.status === "open"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      {inv.pdf_url ? (
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:text-indigo-700 inline-flex items-center gap-1 text-xs"
                        >
                          <Download className="h-3 w-3" />
                          PDF
                        </a>
                      ) : inv.hosted_url ? (
                        <a
                          href={inv.hosted_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:text-indigo-700 inline-flex items-center gap-1 text-xs"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
