"use client";

import { useRef, useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useUser } from "@/app/hooks/useUser";
import { createClient } from "@/lib/auth/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Bell, CreditCard, Download, ExternalLink, Eye, EyeOff, Palette, ReceiptText, ShieldCheck, Upload, UserRound } from "lucide-react";

const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Raleway", "Nunito", "Playfair Display", "Merriweather", "Source Serif 4",
  "DM Sans", "Plus Jakarta Sans", "Syne", "Space Grotesk",
];

interface BrandKit {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  heading_font?: string;
  body_font?: string;
  brand_name?: string;
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

interface BillingStatus {
  plan: string;
  has_billing: boolean;
  subscription_status?: string;
  cancel_at_period_end?: boolean;
  subscription_ends_at?: string | null;
}

export default function AccountSettingsPage() {
  const { user, loading } = useUser();

  // Profile
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Password reset
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({ share_viewed: true, comment_added: true });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // Brand Kit
  const [brandKit, setBrandKit] = useState<BrandKit>({});
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Orders and billing
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cancelEmail, setCancelEmail] = useState("");
  const [cancelLast4, setCancelLast4] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.full_name);
      setCancelEmail((current) => current || user.email || "");
    }
  }, [user]);

  useEffect(() => {
    api.get<BrandKit>("/api/v1/account/brand-kit").then((data) => {
      if (data) setBrandKit(data);
    }).catch(() => {});
    api.get<{ share_viewed: boolean; comment_added: boolean }>("/api/v1/account/notification-preferences")
      .then((data) => { if (data) setNotifPrefs(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadOrders = async () => {
      setBillingLoading(true);
      setBillingError(null);
      try {
        const status = await api.get<BillingStatus>("/api/v1/billing/status");
        if (!mounted) return;
        setBillingStatus(status);

        if (status.has_billing) {
          const [invoiceResult, paymentResult] = await Promise.allSettled([
            api.get<Invoice[]>("/api/v1/billing/invoices"),
            api.get<PaymentMethod | null>("/api/v1/billing/payment-method"),
          ]);
          if (!mounted) return;
          if (invoiceResult.status === "fulfilled") setInvoices(invoiceResult.value);
          if (paymentResult.status === "fulfilled") setPaymentMethod(paymentResult.value);
        }
      } catch (error: any) {
        if (mounted) setBillingError(error?.message ?? "Could not load order data.");
      } finally {
        if (mounted) setBillingLoading(false);
      }
    };

    loadOrders();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveName = async () => {
    setSaving(true);
    await api.put("/api/v1/account/me", { full_name: name });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setSaving(false);
  };

  const handleChangePassword = async () => {
    setPwMessage(null);

    if (newPassword.length < 8) {
      setPwMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setPwSaving(true);
    const authClient = createClient();
    const { error } = await authClient.auth.updateUser({ password: newPassword });
    setPwSaving(false);

    if (error) {
      setPwMessage({ type: "error", text: error.message });
    } else {
      setNewPassword("");
      setConfirmPassword("");
      setPwMessage({ type: "success", text: "Password updated successfully." });
      setTimeout(() => setPwMessage(null), 4000);
    }
  };

  const handleNotifSave = async () => {
    setNotifSaving(true);
    await api.put("/api/v1/account/notification-preferences", notifPrefs);
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2500);
    setNotifSaving(false);
  };

  const handleBrandSave = async () => {
    setBrandSaving(true);
    await api.put("/api/v1/account/brand-kit", brandKit);
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2500);
    setBrandSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/v1/account/brand-kit/logo", {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${(await (await import("@/lib/auth/client")).createClient().auth.getSession()).data.session?.access_token}` },
      });
      const data = await res.json();
      if (data.logo_url) setBrandKit((prev) => ({ ...prev, logo_url: data.logo_url }));
    } finally {
      setLogoUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    await api.post("/api/v1/account/delete");
    window.location.href = "/login";
  };

  const handleCancelSubscription = async () => {
    setCancelMessage(null);
    if (!cancelEmail.trim()) {
      setCancelMessage({ type: "error", text: "Enter your account email to confirm cancellation." });
      return;
    }
    if (cancelLast4.length !== 4) {
      setCancelMessage({ type: "error", text: "Enter the last 4 digits of your card." });
      return;
    }

    setCancelSaving(true);
    try {
      const updated = await api.post<BillingStatus>("/api/v1/billing/subscription/cancel", {
        email: cancelEmail.trim(),
        card_last4: cancelLast4,
      });
      setBillingStatus((prev) => ({ ...(prev ?? updated), ...updated }));
      setCancelEmail("");
      setCancelLast4("");
      setCancelMessage({ type: "success", text: "Subscription cancellation scheduled for the end of your billing period." });
    } catch (error: any) {
      setCancelMessage({ type: "error", text: error?.message ?? "Could not cancel subscription." });
    } finally {
      setCancelSaving(false);
    }
  };

  const formatInvoiceDate = (date: string) =>
    new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const canCancelSubscription =
    billingStatus?.has_billing &&
    !billingStatus.cancel_at_period_end &&
    ["active", "trialing", "past_due"].includes(billingStatus.subscription_status ?? "");

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition";
  const saveBtnCls = "px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-violet-500/20";
  const sectionCls = "bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm";
  const sectionHeaderCls = "px-6 py-4 border-b border-slate-100 flex items-center gap-2";
  const tabTriggerCls = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-none transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 data-[state=active]:border-violet-300 data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm";

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Account settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your general settings, security, preferences, and orders</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-4">
          <TabsTrigger value="general" className={tabTriggerCls}>
            General
          </TabsTrigger>
          <TabsTrigger value="security" className={tabTriggerCls}>
            Security
          </TabsTrigger>
          <TabsTrigger value="preferences" className={tabTriggerCls}>
            Preferences
          </TabsTrigger>
          <TabsTrigger value="orders" className={tabTriggerCls}>
            Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0 space-y-6">
      <section className={sectionCls}>
        <div className={sectionHeaderCls}>
          <UserRound className="w-4 h-4 text-violet-500" />
          <div>
            <h2 className="font-semibold text-slate-900">General account settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">Your display name and email address</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
            <input
              value={user?.email ?? ""}
              disabled
              className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-400 cursor-not-allowed"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button onClick={handleSaveName} disabled={saving} className={saveBtnCls}>
              {saved ? "✓ Saved" : saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </section>

      {/* Delete account */}
      <section className="bg-white border border-red-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50/50">
          <h2 className="font-semibold text-red-700">Delete account</h2>
          <p className="text-xs text-red-500/80 mt-0.5">Permanently remove your account and all data</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-4">
            Deleting your account will remove all files you have created with us. Please ensure you have made backups. This action cannot be undone.
          </p>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 hover:border-red-300 transition-all"
            >
              Delete my account
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
              >
                {deleting ? "Deleting…" : "Yes, delete everything"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
        </TabsContent>

        <TabsContent value="security" className="mt-0">
      <section className={sectionCls}>
        <div className={sectionHeaderCls}>
          <ShieldCheck className="w-4 h-4 text-violet-500" />
          <div>
            <h2 className="font-semibold text-slate-900">Security</h2>
            <p className="text-xs text-slate-500 mt-0.5">Update your password and account access</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
              <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm new password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
              <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {pwMessage && (
            <p className={`text-sm px-3 py-2.5 rounded-xl border ${
              pwMessage.type === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {pwMessage.text}
            </p>
          )}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleChangePassword}
              disabled={pwSaving || !newPassword || !confirmPassword}
              className={saveBtnCls}
            >
              {pwSaving ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>
      </section>
        </TabsContent>

        <TabsContent value="preferences" className="mt-0">
      <section className={sectionCls}>
        <div className={sectionHeaderCls}>
          <Bell className="w-4 h-4 text-violet-500" />
          <div>
            <h2 className="font-semibold text-slate-900">Preferences</h2>
            <p className="text-xs text-slate-500 mt-0.5">Choose notifications and presentation defaults</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
              <p className="text-xs text-slate-500 mt-0.5">Choose what you want to be emailed about</p>
            </div>
            {[
              { key: "share_viewed" as const, label: "Presentation viewed", desc: "Get notified when someone opens a shared link (max once per day per link)" },
              { key: "comment_added" as const, label: "New comment", desc: "Get notified when someone leaves a comment on your presentation" },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-colors -mx-1">
                <input
                  type="checkbox"
                  checked={notifPrefs[key]}
                  onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="h-4 w-4 mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
            <div className="flex justify-end pt-1">
              <button onClick={handleNotifSave} disabled={notifSaving} className={saveBtnCls}>
                {notifSaved ? "✓ Saved" : notifSaving ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="mb-5 flex items-center gap-2">
              <Palette className="w-4 h-4 text-violet-500" />
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Brand Kit</h3>
                <p className="text-xs text-slate-500 mt-0.5">Applied to new presentations automatically</p>
              </div>
            </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Logo</label>
            <div className="flex items-center gap-4">
              {brandKit.logo_url ? (
                <img src={brandKit.logo_url} alt="Brand logo" className="h-14 w-auto max-w-[120px] object-contain border border-slate-200 rounded-xl p-1.5 bg-slate-50" />
              ) : (
                <div className="h-14 w-28 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs bg-slate-50">
                  No logo
                </div>
              )}
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {logoUploading ? "Uploading…" : "Upload logo"}
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Brand name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Brand name</label>
            <input
              value={brandKit.brand_name ?? ""}
              onChange={(e) => setBrandKit((p) => ({ ...p, brand_name: e.target.value }))}
              placeholder="e.g. Acme Corp"
              className={inputCls}
            />
        </div>

          {/* Colours */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Brand colours</label>
            <div className="grid grid-cols-3 gap-3">
              {(["primary_color", "secondary_color", "accent_color"] as const).map((key) => (
                <div key={key}>
                  <p className="text-xs text-slate-500 mb-1.5 capitalize">{key.replace("_color", "").replace("_", " ")}</p>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-2 py-1.5 bg-white">
                    <input
                      type="color"
                      value={brandKit[key] ?? "#5141E5"}
                      onChange={(e) => setBrandKit((p) => ({ ...p, [key]: e.target.value }))}
                      className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={brandKit[key] ?? ""}
                      onChange={(e) => setBrandKit((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="#000000"
                      className="flex-1 text-xs font-mono text-slate-700 bg-transparent border-0 focus:outline-none min-w-0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fonts */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Typography</label>
            <div className="grid grid-cols-2 gap-3">
              {(["heading_font", "body_font"] as const).map((key) => (
                <div key={key}>
                  <p className="text-xs text-slate-500 mb-1.5 capitalize">{key.replace("_font", "")} font</p>
                  <select
                    value={brandKit[key] ?? ""}
                    onChange={(e) => setBrandKit((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700"
                  >
                    <option value="">Default</option>
                    {GOOGLE_FONTS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button onClick={handleBrandSave} disabled={brandSaving} className={saveBtnCls}>
              {brandSaved ? "✓ Saved" : brandSaving ? "Saving…" : "Save brand kit"}
            </button>
          </div>
          </div>
        </div>
      </section>
        </TabsContent>

        <TabsContent value="orders" className="mt-0 space-y-6">
      <section className={sectionCls}>
        <div className={sectionHeaderCls}>
          <ReceiptText className="w-4 h-4 text-violet-500" />
          <div>
            <h2 className="font-semibold text-slate-900">Orders</h2>
            <p className="text-xs text-slate-500 mt-0.5">Subscription, payment method, and invoice history</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          {billingLoading ? (
            <p className="text-sm text-slate-500">Loading order data...</p>
          ) : billingError ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{billingError}</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current plan</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-bold capitalize text-violet-700">
                      {billingStatus?.plan ?? "free"}
                    </span>
                    {billingStatus?.cancel_at_period_end && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Cancels soon
                      </span>
                    )}
                  </div>
                  {billingStatus?.subscription_ends_at && (
                    <p className="mt-2 text-xs text-slate-500">
                      Access ends on {formatInvoiceDate(billingStatus.subscription_ends_at)}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Payment method</p>
                  {paymentMethod ? (
                    <div className="mt-2 flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-slate-400" />
                      <div>
                        <p className="text-sm font-semibold capitalize text-slate-800">
                          {paymentMethod.brand} ending {paymentMethod.last4}
                        </p>
                        <p className="text-xs text-slate-500">
                          Expires {paymentMethod.exp_month}/{paymentMethod.exp_year}
                        </p>
                      </div>
                    </div>
                  ) : billingStatus?.cancel_at_period_end ? (
                    <p className="mt-2 text-sm text-slate-500">
                      Cancellation is scheduled, so payment method details are not shown here.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No saved card found.</p>
                  )}
                </div>
              </div>

              {billingStatus?.cancel_at_period_end && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Subscription cancellation is scheduled. You can keep using Pro until
                    {billingStatus.subscription_ends_at
                      ? ` ${formatInvoiceDate(billingStatus.subscription_ends_at)}.`
                      : " the end of your current billing period."}
                  </p>
                </div>
              )}

              {canCancelSubscription && (
                <div className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div>
                      <h3 className="text-sm font-semibold text-red-700">Cancel subscription</h3>
                      <p className="mt-0.5 text-xs text-red-500/80">
                        Confirm your account email and card last 4 digits to schedule cancellation.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
                    <input
                      value={cancelEmail}
                      onChange={(e) => setCancelEmail(e.target.value)}
                      placeholder={user?.email ?? "Account email"}
                      className={inputCls}
                    />
                    <input
                      value={cancelLast4}
	                      onChange={(e) => setCancelLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
	                      placeholder="Card last 4"
	                      inputMode="numeric"
	                      maxLength={4}
	                      className={inputCls}
	                    />
	                  </div>
	                  {!paymentMethod && (
	                    <p className="mt-2 text-xs text-red-500/80">
	                      We could not display the saved card, but Stripe may still require the card last 4 digits to confirm cancellation.
	                    </p>
	                  )}
                  {cancelMessage && (
                    <p className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                      cancelMessage.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}>
                      {cancelMessage.text}
                    </p>
                  )}
                  <div className="mt-4 flex justify-end">
	                    <button
	                      onClick={handleCancelSubscription}
	                      disabled={cancelSaving || !cancelEmail.trim() || cancelLast4.length !== 4}
	                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
	                    >
                      {cancelSaving ? "Cancelling..." : "Cancel subscription"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className={sectionCls}>
        <div className={sectionHeaderCls}>
          <ReceiptText className="w-4 h-4 text-violet-500" />
          <div>
            <h2 className="font-semibold text-slate-900">Invoices</h2>
            <p className="text-xs text-slate-500 mt-0.5">Recent payments loaded from billing records</p>
          </div>
        </div>
        <div className="px-6 py-5">
          {billingLoading ? (
            <p className="text-sm text-slate-500">Loading invoices...</p>
          ) : invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <ReceiptText className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">No invoices yet</p>
              <p className="mt-1 text-xs text-slate-500">Paid invoices will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-violet-200 hover:shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{invoice.description}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          invoice.status === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : invoice.status === "open"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatInvoiceDate(invoice.date)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <p className="text-sm font-bold text-slate-900">
                        ${invoice.amount.toFixed(2)} {invoice.currency}
                      </p>
                      {invoice.pdf_url ? (
                        <a
                          href={invoice.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      ) : invoice.hosted_url ? (
                        <a
                          href={invoice.hosted_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">No file</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
