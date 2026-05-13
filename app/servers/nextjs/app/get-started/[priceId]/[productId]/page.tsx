"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/auth/client";

type FormState = {
  name: string;
  country: string;
};

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => any;
  }
}

const initialForm: FormState = {
  name: "",
  country: "United States",
};

function inputClass(extra = "") {
  return [
    "h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950",
    "placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100",
    extra,
  ].join(" ");
}

function stripeFieldClass() {
  return "rounded-lg border border-slate-300 bg-white px-3 py-3";
}

export default function GetStartedCheckoutPage() {
  const params = useParams<{ priceId: string; productId: string }>();
  const router = useRouter();
  const authClient = createClient();

  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState(false);
  const [stripe, setStripe] = useState<any>(null);
  const [cardNumber, setCardNumber] = useState<any>(null);

  const cardNumberRef = useRef<HTMLDivElement | null>(null);
  const expiryRef = useRef<HTMLDivElement | null>(null);
  const cvcRef = useRef<HTMLDivElement | null>(null);
  const mountedElementsRef = useRef<any[]>([]);

  const priceId = useMemo(
    () => decodeURIComponent(String(params?.priceId ?? "")),
    [params?.priceId]
  );

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const ensureSession = async () => {
    const {
      data: { session },
    } = await authClient.auth.getSession();

    if (!session?.access_token) {
      router.push("/login?message=please_login");
      throw new Error("Please log in before checkout.");
    }
  };

  const loadStripeJs = () =>
    new Promise<void>((resolve, reject) => {
      if (window.Stripe) {
        resolve();
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>("script[src='https://js.stripe.com/v3/']");
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Stripe.js failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Stripe.js failed to load."));
      document.head.appendChild(script);
    });

  const prepareCardFields = async (isCancelled: () => boolean) => {
    await ensureSession();
    if (isCancelled()) return;

    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error("Stripe publishable key is missing.");
    }

    await loadStripeJs();
    if (isCancelled()) return;

    const stripeClient = window.Stripe?.(publishableKey);
    if (!stripeClient) throw new Error("Stripe could not be initialized.");

    const elements = stripeClient.elements({
      fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" }],
    });
    const elementStyle = {
      base: {
        color: "#020617",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "15px",
        "::placeholder": { color: "#94a3b8" },
      },
      invalid: { color: "#dc2626" },
    };

    if (!cardNumberRef.current || !expiryRef.current || !cvcRef.current) {
      throw new Error("Payment fields are not ready.");
    }

    mountedElementsRef.current.forEach((element) => element.unmount());
    mountedElementsRef.current = [];
    cardNumberRef.current.innerHTML = "";
    expiryRef.current.innerHTML = "";
    cvcRef.current.innerHTML = "";

    const numberElement = elements.create("cardNumber", { style: elementStyle, placeholder: "Card Number" });
    const expiryElement = elements.create("cardExpiry", { style: elementStyle, placeholder: "MM / YY" });
    const cvcElement = elements.create("cardCvc", { style: elementStyle, placeholder: "CVV / CVC" });

    numberElement.mount(cardNumberRef.current);
    expiryElement.mount(expiryRef.current);
    cvcElement.mount(cvcRef.current);
    mountedElementsRef.current = [numberElement, expiryElement, cvcElement];

    setStripe(stripeClient);
    setCardNumber(numberElement);
    setCardReady(true);
  };

  const handleActivate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!priceId) {
      setError("Missing Stripe price id.");
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setLoading(true);
    try {
      if (!cardReady) {
        setError("Secure card form is still loading. Please try again in a moment.");
        setLoading(false);
        return;
      }

      const intent = await api.post<{
        client_secret: string;
        subscription_id: string;
      }>("/api/v1/billing/subscription-intent", { price_id: priceId });

      const result = await stripe.confirmCardPayment(intent.client_secret, {
        payment_method: {
          card: cardNumber,
          billing_details: {
            name: form.name.trim(),
            address: { country: form.country === "Bangladesh" ? "BD" : form.country === "United Kingdom" ? "GB" : form.country === "Canada" ? "CA" : form.country === "Australia" ? "AU" : "US" },
          },
        },
      });

      if (result.error) throw new Error(result.error.message);

      await api.post("/api/v1/billing/subscription/sync", { subscription_id: intent.subscription_id });
      router.push("/settings/billing?success=true");
    } catch (err: any) {
      setError(err?.message ?? "Could not complete checkout. Please try again.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!priceId || cardReady) return;

    let cancelled = false;
    prepareCardFields(() => cancelled).catch((err: any) => {
      if (!cancelled) {
        setError(err?.message ?? "Could not load secure card form.");
      }
    });

    return () => {
      cancelled = true;
      mountedElementsRef.current.forEach((element) => element.unmount());
      mountedElementsRef.current = [];
    };
    // prepareCardFields intentionally runs once per price id to mount Stripe Elements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceId]);

  return (
    <main className="min-h-screen bg-[#f4f4f5] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-center gap-3 px-5">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shadow-[0_12px_30px_rgba(124,58,237,0.22)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <span className="text-slate-950 font-bold text-sm tracking-tight">Unslid</span>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-5 py-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight">Activate your plan</h1>
              <p className="mt-1 text-sm text-slate-500">
                Secure card payment, instant access <span className="font-bold text-amber-500">5.0 rating</span>
              </p>
            </div>
            <div className="hidden h-20 w-20 items-center justify-center rounded-full bg-red-50 md:flex">
              <Sparkles className="h-10 w-10 text-red-500" strokeWidth={2.5} />
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleActivate} className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-bold">Name on the card</label>
              <input
                className={inputClass("mt-3 w-full")}
                placeholder="Full Name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-bold">Card Number</label>
              <div className={`${stripeFieldClass()} mt-3 min-h-11`}>
                <div ref={cardNumberRef}>{!cardReady && <span className="text-sm text-slate-400">Card Number</span>}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-bold">Expiration date</label>
                <div className={`${stripeFieldClass()} mt-3 min-h-11`}>
                  <div ref={expiryRef}>{!cardReady && <span className="text-sm text-slate-400">MM / YY</span>}</div>
                </div>
              </div>
              <div>
                <label className="text-sm font-bold">CVC</label>
                <div className={`${stripeFieldClass()} mt-3 min-h-11`}>
                  <div ref={cvcRef}>{!cardReady && <span className="text-sm text-slate-400">CVV / CVC</span>}</div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-bold">Country / Region</label>
              <select
                className={`${inputClass("mt-3 w-full")} appearance-none`}
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
              >
                <option>United States</option>
                <option>Bangladesh</option>
                <option>United Kingdom</option>
                <option>Canada</option>
                <option>Australia</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-8 w-full rounded-lg bg-violet-600 text-sm font-black tracking-wide text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "PROCESSING..." : cardReady ? "PAY & ACTIVATE" : "LOADING SECURE CARD FORM..."}
            </button>

            <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-400">
              <LockKeyhole className="h-3.5 w-3.5" />
              Card details are encrypted by Stripe and never stored by Unslid.
            </p>
          </form>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-center">
            <h2 className="text-xl font-black leading-7 text-violet-500">
              Join creators building better decks in minutes
            </h2>
            <div className="mt-4 text-xl font-black text-amber-500">5.0 / 5.0</div>
            <p className="mt-2 text-sm text-slate-500">based on trusted reviews</p>
          </div>

          <div className="mt-8 rounded-lg bg-slate-50 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Unslid Pro</span>
              <span className="text-sm font-black text-slate-900">Subscription</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Premium presentation generation, export tools, templates, and priority workspace access.
            </p>
          </div>

          <div className="mt-8 space-y-7">
            <div>
              <h3 className="text-base font-black">Privacy Guarantee</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Your files and billing information are handled responsibly and confidentially.
              </p>
            </div>

            <div>
              <h3 className="text-base font-black">Secure payment</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Stripe verifies and processes the card directly on this page. Strong customer
                authentication may open a bank verification step when required.
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center">
            <p className="text-sm text-slate-500">Unslid Inc.</p>
            <div className="mt-7 flex items-center justify-center gap-3">
              <div className="flex h-9 items-center gap-1 rounded border border-slate-200 px-2 text-[10px] font-black text-emerald-700">
                <BadgeCheck className="h-4 w-4" />
                VERIFIED
              </div>
              <div className="flex h-9 items-center gap-1 rounded border border-slate-200 px-2 text-[10px] font-black text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                PCI DSS
              </div>
              <div className="flex h-9 items-center gap-1 rounded border border-slate-200 px-2 text-[10px] font-black text-slate-700">
                <Globe2 className="h-4 w-4 text-violet-600" />
                GDPR
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/settings/billing")}
            className="mt-8 w-full rounded-lg border border-slate-300 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            View all plans
          </button>
        </aside>
      </section>
    </main>
  );
}
