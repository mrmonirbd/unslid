"use client";

import { useRef, useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useUser } from "@/app/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Upload, Palette, Bell } from "lucide-react";

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

  useEffect(() => {
    if (user) setName(user.full_name);
  }, [user]);

  useEffect(() => {
    api.get<BrandKit>("/api/v1/account/brand-kit").then((data) => {
      if (data) setBrandKit(data);
    }).catch(() => {});
    api.get<{ share_viewed: boolean; comment_added: boolean }>("/api/v1/account/notification-preferences")
      .then((data) => { if (data) setNotifPrefs(data); })
      .catch(() => {});
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
      setPwMessage({ type: "error", text: "パスワードは8文字以上である必要があります。" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "パスワードが一致しません。" });
      return;
    }

    setPwSaving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwSaving(false);

    if (error) {
      setPwMessage({ type: "error", text: error.message });
    } else {
      setNewPassword("");
      setConfirmPassword("");
      setPwMessage({ type: "success", text: "パスワードが正常に更新されました。" });
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
        headers: { Authorization: `Bearer ${(await (await import("@/lib/supabase/client")).createClient().auth.getSession()).data.session?.access_token}` },
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

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";
  const saveBtnCls = "px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-indigo-500/20";

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">アカウント設定</h1>
        <p className="text-slate-500 text-sm mt-1">プロフィール、ブランド、設定を管理します</p>
      </div>

      <div className="space-y-6">

      {/* Profile */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">プロフィール</h2>
          <p className="text-xs text-slate-500 mt-0.5">表示名とメールアドレス</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">氏名</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">メールアドレス</label>
            <input
              value={user?.email ?? ""}
              disabled
              className="w-full px-3 py-2.5 border border-slate-200 bg-slate-50 rounded-xl text-sm text-slate-400 cursor-not-allowed"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button onClick={handleSaveName} disabled={saving} className={saveBtnCls}>
              {saved ? "✓ 保存済み" : saving ? "保存中…" : "変更を保存"}
            </button>
          </div>
        </div>
      </section>

      {/* Notification Preferences */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-500" />
          <div>
            <h2 className="font-semibold text-slate-900">通知</h2>
            <p className="text-xs text-slate-500 mt-0.5">メール通知の設定を選択してください</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          {[
            { key: "share_viewed" as const, label: "プレゼンが閲覧されました", desc: "共有リンクが開かれたときに通知します（1日1リンクにつき最大1回）" },
            { key: "comment_added" as const, label: "新しいコメント", desc: "プレゼンにコメントが追加されたときに通知します" },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-slate-50 transition-colors -mx-1">
              <input
                type="checkbox"
                checked={notifPrefs[key]}
                onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="h-4 w-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
          <div className="flex justify-end pt-1">
            <button onClick={handleNotifSave} disabled={notifSaving} className={saveBtnCls}>
              {notifSaved ? "✓ 保存済み" : notifSaving ? "保存中…" : "設定を保存"}
            </button>
          </div>
        </div>
      </section>

      {/* Brand Kit */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Palette className="w-4 h-4 text-indigo-500" />
          <div>
            <h2 className="font-semibold text-slate-900">ブランドキット</h2>
            <p className="text-xs text-slate-500 mt-0.5">新しいプレゼンに自動的に適用されます</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">

          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">ロゴ</label>
            <div className="flex items-center gap-4">
              {brandKit.logo_url ? (
                <img src={brandKit.logo_url} alt="Brand logo" className="h-14 w-auto max-w-[120px] object-contain border border-slate-200 rounded-xl p-1.5 bg-slate-50" />
              ) : (
                <div className="h-14 w-28 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-xs bg-slate-50">
                  ロゴなし
                </div>
              )}
              <button
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {logoUploading ? "アップロード中…" : "ロゴをアップロード"}
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          {/* Brand name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">ブランド名</label>
            <input
              value={brandKit.brand_name ?? ""}
              onChange={(e) => setBrandKit((p) => ({ ...p, brand_name: e.target.value }))}
              placeholder="例：Acme Corp"
              className={inputCls}
            />
        </div>

          {/* Colours */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">ブランドカラー</label>
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
            <label className="block text-sm font-medium text-slate-700 mb-2">タイポグラフィ</label>
            <div className="grid grid-cols-2 gap-3">
              {(["heading_font", "body_font"] as const).map((key) => (
                <div key={key}>
                  <p className="text-xs text-slate-500 mb-1.5 capitalize">{key.replace("_font", "")} font</p>
                  <select
                    value={brandKit[key] ?? ""}
                    onChange={(e) => setBrandKit((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700"
                  >
                    <option value="">デフォルト</option>
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
              {brandSaved ? "✓ 保存済み" : brandSaving ? "保存中…" : "ブランドキットを保存"}
            </button>
          </div>
        </div>
      </section>

      {/* Change password */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">パスワードを変更</h2>
          <p className="text-xs text-slate-500 mt-0.5">アカウントのパスワードを更新します</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">新しいパスワード</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="最低8文字"
                className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
              <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">新しいパスワードを確認</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="新しいパスワードを再入力"
                className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
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
              {pwSaving ? "更新中…" : "パスワードを更新"}
            </button>
          </div>
        </div>
      </section>

      {/* Delete account */}
      <section className="bg-white border border-red-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50/50">
          <h2 className="font-semibold text-red-700">アカウントを削除</h2>
          <p className="text-xs text-red-500/80 mt-0.5">アカウントとすべてのデータを完全に削除します</p>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600 mb-4">
            アカウントを削除すると、作成したすべてのファイルが削除されます。バックアップを取っていることを確認してください。この操作は取り消せません。
          </p>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 hover:border-red-300 transition-all"
            >
              アカウントを削除する
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
              >
                {deleting ? "削除中…" : "はい、すべて削除します"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
      </section>

      </div>
    </div>
  );
}
