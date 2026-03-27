"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import {
  Users, TrendingUp, TrendingDown, Zap, DollarSign,
  Activity, Target, BarChart2, ArrowLeft, RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface GrowthStats {
  signups_by_day: { date: string; signups: number }[];
  signups_this_month: number;
  signups_last_month: number;
  active_users_7d: number;
  active_users_30d: number;
  activation_rate: number;
  total_users: number;
  activated_users: number;
  conversion_rate: number;
  total_free: number;
  total_paid: number;
  utm_breakdown: { source: string; count: number }[];
  mrr_estimate: number;
  generated_at: string;
}

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#06b6d4"];

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color = "indigo",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  color?: "indigo" | "emerald" | "violet" | "amber" | "rose";
}) {
  const colorMap = {
    indigo:  { bg: "bg-indigo-50",  icon: "text-indigo-500",  ring: "ring-indigo-100" },
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", ring: "ring-emerald-100" },
    violet:  { bg: "bg-violet-50",  icon: "text-violet-500",  ring: "ring-violet-100" },
    amber:   { bg: "bg-amber-50",   icon: "text-amber-500",   ring: "ring-amber-100" },
    rose:    { bg: "bg-rose-50",    icon: "text-rose-500",    ring: "ring-rose-100" },
  };
  const c = colorMap[color];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            trend === "up" ? "bg-emerald-50 text-emerald-600" :
            trend === "down" ? "bg-red-50 text-red-600" :
            "bg-slate-50 text-slate-500"
          }`}>
            {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900 mb-0.5">{value}</p>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function AdminStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<GrowthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError(null);
    try {
      const data = await api.get<GrowthStats>("/api/v1/admin/growth-stats");
      if (data) setStats(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "統計の読み込みに失敗しました");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const signupTrend: "up" | "down" | "neutral" = !stats ? "neutral" :
    stats.signups_this_month > stats.signups_last_month ? "up" :
    stats.signups_this_month < stats.signups_last_month ? "down" : "neutral";

  const funnelData = stats ? [
    { name: "登録済み",    value: stats.total_users },
    { name: "アクティベート済み",    value: stats.activated_users },
    { name: "有料",         value: stats.total_paid },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-8 py-10">
        <Link href="/admin" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition mb-6">
          <ArrowLeft className="w-4 h-4" />
          管理者
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <p className="text-red-700 font-medium mb-2">分析を読み込めませんでした</p>
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => load()}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition">
            <ArrowLeft className="w-4 h-4" />
            管理者
          </Link>
          <div className="w-px h-4 bg-slate-200" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">成長分析</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {stats ? `最終更新：${new Date(stats.generated_at).toLocaleTimeString()}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          更新
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="総ユーザー数"
          value={stats?.total_users ?? 0}
          icon={Users}
          color="indigo"
          sub={`過去30日間のアクティブ：${stats?.active_users_30d ?? 0}`}
        />
        <StatCard
          label="今月の登録数"
          value={stats?.signups_this_month ?? 0}
          icon={TrendingUp}
          color="emerald"
          trend={signupTrend}
          sub={`先月：${stats?.signups_last_month ?? 0}`}
        />
        <StatCard
          label="有料顧客"
          value={stats?.total_paid ?? 0}
          icon={DollarSign}
          color="violet"
          sub={`コンバージョン率：${stats?.conversion_rate ?? 0}%`}
        />
        <StatCard
          label="推定MRR"
          value={stats?.mrr_estimate ? `$${stats.mrr_estimate.toLocaleString()}` : "$0"}
          icon={Activity}
          color="amber"
          sub="アクティブな有料プランに基づく"
        />
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="アクティブ（7日間）"
          value={stats?.active_users_7d ?? 0}
          icon={Zap}
          color="emerald"
          sub="デッキを作成・編集したユーザー"
        />
        <StatCard
          label="アクティブ（30日間）"
          value={stats?.active_users_30d ?? 0}
          icon={Zap}
          color="indigo"
          sub="月間アクティブユーザー（MAU）"
        />
        <StatCard
          label="アクティベーション率"
          value={`${stats?.activation_rate ?? 0}%`}
          icon={Target}
          color="violet"
          sub="登録済みかつプレゼン作成済み"
        />
        <StatCard
          label="無料ユーザー"
          value={stats?.total_free ?? 0}
          icon={Users}
          color="amber"
          sub="アップグレード候補"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Signup trend — full width on mobile, 2/3 on desktop */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">登録数 — 過去30日間</h2>
              <p className="text-xs text-slate-500 mt-0.5">1日ごとの新規ユーザー登録数</p>
            </div>
            <BarChart2 className="w-5 h-5 text-slate-300" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.signups_by_day ?? []} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                interval={4}
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="signups" fill="#6366f1" radius={[4, 4, 0, 0]} name="新規登録数" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Conversion funnel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900 text-sm">コンバージョンファネル</h2>
            <p className="text-xs text-slate-500 mt-0.5">登録 → アクティベーション → 有料</p>
          </div>
          <div className="space-y-3">
            {funnelData.map((step, i) => {
              const pct = funnelData[0].value > 0 ? Math.round((step.value / funnelData[0].value) * 100) : 0;
              return (
                <div key={step.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{step.name}</span>
                    <span className="text-xs font-bold text-slate-900">{step.value} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: COLORS[i],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Plan donut */}
          <div className="mt-6">
            <p className="text-xs font-medium text-slate-500 mb-3">プラン別ユーザー</p>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={[
                    { name: "無料",  value: stats?.total_free ?? 0 },
                    { name: "有料",  value: stats?.total_paid ?? 0 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={50}
                  dataKey="value"
                  paddingAngle={2}
                >
                  <Cell fill="#e0e7ff" />
                  <Cell fill="#6366f1" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(v) => <span className="text-xs text-slate-600">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* UTM breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900 text-sm">獲得ソース（UTM）</h2>
            <p className="text-xs text-slate-500 mt-0.5">登録者の流入元</p>
          </div>

          {!stats?.utm_breakdown?.length ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Target className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">まだUTMデータがありません</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                UTMパラメーターは、ユーザーがトラッキングリンクから登録したときに自動的に保存されます
                （例：<code className="bg-slate-100 px-1 rounded text-[11px]">?utm_source=google&utm_medium=cpc</code>）。
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.utm_breakdown} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="登録数" radius={[0, 4, 4, 0]}>
                  {stats.utm_breakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick tips panel */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-sm">
          <h2 className="font-semibold text-sm mb-1">マーケティング & トラッキングのヒント</h2>
          <p className="text-indigo-200 text-xs mb-5">分析を最大限に活用する</p>
          <div className="space-y-4">
            {[
              {
                title: "広告リンクにタグを付ける",
                desc: "すべてのGoogle / LinkedIn / Meta広告URLに ?utm_source=google&utm_medium=cpc&utm_campaign=brand を追加してください。UTMパラメーターは登録時に自動的に保存されます。",
              },
              {
                title: "Google Analytics 4",
                desc: ".envに NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX を設定してGA4を有効にします。ページビュー、sign_upイベントを追跡し、Google Adsとコンバージョン最適化のために連携します。",
              },
              {
                title: "アクティベーション率の目標",
                desc: "SaaSの業界ベンチマークは40〜60%です。それを下回る場合は、オンボーディングを改善してください — 例えば、初回ログイン時にデモデッキを表示する。",
              },
              {
                title: "無料 → 有料コンバージョン",
                desc: "健全なSaaSは無料ユーザーの2〜5%を有料に転換します。摩擦ポイント（エクスポート制限、共有、高度なテンプレート）でアプリ内アップグレードを促しましょう。",
              },
            ].map((tip) => (
              <div key={tip.title} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{tip.title}</p>
                  <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
