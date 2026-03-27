"use client";

import { useState, useEffect } from "react";
import { api, OrgSummary } from "@/lib/api";
import { Users, Mail, Clock, Shield, UserX, RefreshCw, Crown, AlertTriangle, Plus, Minus, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface OrgDetail {
  id: number;
  name: string;
  slug: string;
  plan: string;
  seats_purchased: number;
  seats_used: number;
  active_members: number;
  pending_invites: number;
  role: string;
  storage_used_bytes: number;
  created_at: string;
}

interface MemberOrInvite {
  type: "member" | "invitation";
  user_id?: number;
  invitation_token?: string;
  email: string;
  full_name?: string | null;
  role: string;
  status: "active" | "pending";
  joined_at?: string;
  expires_at?: string;
  expires_soon?: boolean;
}

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  member: "bg-slate-100 text-slate-600",
};

export default function TeamPage() {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrgDetail | null>(null);
  const [members, setMembers] = useState<MemberOrInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Seat management
  const [seatInput, setSeatInput] = useState(2);
  const [seatSaving, setSeatSaving] = useState(false);
  const [seatConfirm, setSeatConfirm] = useState(false);

  // Transfer ownership
  const [transferTo, setTransferTo] = useState<number | null>(null);
  const [transferConfirm, setTransferConfirm] = useState(false);

  // Remove member confirm
  const [removeConfirm, setRemoveConfirm] = useState<number | null>(null);

  useEffect(() => {
    api.get<OrgSummary[]>("/api/v1/org")
      .then(setOrgs)
      .finally(() => setLoading(false));
  }, []);

  const loadOrg = async (slug: string) => {
    setMembersLoading(true);
    setInviteError(null);
    try {
      const [org, memberList] = await Promise.all([
        api.get<OrgDetail>(`/api/v1/org/${slug}`),
        api.get<MemberOrInvite[]>(`/api/v1/org/${slug}/members`),
      ]);
      setSelectedOrg(org);
      setMembers(memberList);
      setSeatInput(org.seats_purchased);
    } catch {
      toast.error("チームの詳細の読み込みに失敗しました");
    } finally {
      setMembersLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedOrg) return;
    setInviting(true);
    setInviteError(null);
    try {
      await api.post(`/api/v1/org/${selectedOrg.slug}/invite`, { email: inviteEmail, role: inviteRole });
      toast.success(`${inviteEmail}に招待を送信しました`);
      setInviteEmail("");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      const detail = e.message || "招待の送信に失敗しました";
      if (detail.includes("seats_full") || detail.includes("seats are in use")) {
        setInviteError("すべてのシートが使用中です。招待する前に下でシートを追加してください。");
      } else {
        setInviteError(detail);
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedOrg) return;
    setRemoveConfirm(null);
    try {
      await api.delete(`/api/v1/org/${selectedOrg.slug}/members/${userId}`);
      toast.success("メンバーを削除しました");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "メンバーの削除に失敗しました");
    }
  };

  const handleCancelInvite = async (token: string) => {
    if (!selectedOrg) return;
    try {
      await api.delete(`/api/v1/org/${selectedOrg.slug}/invitations/${token}`);
      toast.success("招待をキャンセルしました");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "招待のキャンセルに失敗しました");
    }
  };

  const handleResendInvite = async (token: string) => {
    if (!selectedOrg) return;
    try {
      await api.post(`/api/v1/org/${selectedOrg.slug}/invitations/${token}/resend`);
      toast.success("招待を再送しました");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "招待の再送に失敗しました");
    }
  };

  const handleUpdateSeats = async () => {
    if (!selectedOrg) return;
    setSeatSaving(true);
    setSeatConfirm(false);
    try {
      await api.patch(`/api/v1/org/${selectedOrg.slug}/seats`, { seats: seatInput });
      toast.success(`${seatInput}シートに更新しました`);
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "シートの更新に失敗しました");
      setSeatInput(selectedOrg.seats_purchased);
    } finally {
      setSeatSaving(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedOrg || !transferTo) return;
    setTransferConfirm(false);
    try {
      await api.post(`/api/v1/org/${selectedOrg.slug}/transfer-ownership`, { new_owner_user_id: transferTo });
      toast.success("オーナーシップを移転しました");
      setTransferTo(null);
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "オーナーシップの移転に失敗しました");
    }
  };

  const handleChangeRole = async (userId: number, role: "admin" | "member") => {
    if (!selectedOrg) return;
    try {
      await api.patch(`/api/v1/org/${selectedOrg.slug}/members/${userId}/role`, { role });
      toast.success("役割を更新しました");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "役割の変更に失敗しました");
    }
  };

  if (loading) return <div className="p-8 text-slate-500 text-sm">読み込み中...</div>;

  const isOwner = selectedOrg?.role === "owner";
  const isAdmin = selectedOrg?.role === "admin" || isOwner;
  const seatPct = selectedOrg ? Math.min(100, ((selectedOrg.seats_used) / selectedOrg.seats_purchased) * 100) : 0;
  const seatColor = seatPct >= 100 ? "bg-red-500" : seatPct >= 80 ? "bg-amber-400" : "bg-indigo-500";

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">チーム</h1>

      {/* Org selector */}
      {orgs.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-slate-800">所属組織</h2>
          <div className="space-y-2">
            {orgs.map((o) => (
              <button
                key={o.id}
                onClick={() => loadOrg(o.slug)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition ${
                  selectedOrg?.slug === o.slug ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div>
                  <p className="font-medium text-slate-800 text-sm">{o.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{o.slug} · {o.plan}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[o.role] ?? "bg-slate-100 text-slate-600"}`}>
                    {o.role}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {orgs.length === 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
          <Users className="h-8 w-8 text-slate-300 mx-auto" />
          <h2 className="font-semibold text-slate-800">チームなし</h2>
          <p className="text-sm text-slate-500">現在のプランではチームメンバーを招待できません。チームプランにアップグレードして同僚を招待し、プレゼンを共同作業しましょう。
          </p>
          <a href="/settings/billing" className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-500 transition">
            チームにアップグレード
          </a>
        </section>
      )}

      {/* Org details */}
      {selectedOrg && (
        <>
          {/* Seat usage bar */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">シート</h2>
              <span className="text-sm text-slate-500">
                {selectedOrg.seats_purchased}シート中 {selectedOrg.seats_used}使用中
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${seatColor}`} style={{ width: `${seatPct}%` }} />
            </div>
            {seatPct >= 100 && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> すべてのシートが使用中です。追加のシートを増やして、新しいメンバーを招待してください。
              </p>
            )}
            {seatPct >= 80 && seatPct < 100 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> 残り{selectedOrg.seats_purchased - selectedOrg.seats_used}シートのみです。
              </p>
            )}

            {/* Seat adjustment (owner only) */}
            {isOwner && (
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <p className="text-sm font-medium text-slate-700">シートを調整</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSeatInput((s) => Math.max(2, s - 1))}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center font-semibold text-slate-800">{seatInput}</span>
                  <button
                    onClick={() => setSeatInput((s) => s + 1)}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (seatInput < selectedOrg.seats_purchased || seatInput < selectedOrg.seats_used + 1) {
                        setSeatConfirm(true);
                      } else {
                        handleUpdateSeats();
                      }
                    }}
                    disabled={seatSaving || seatInput === selectedOrg.seats_purchased}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                  >
                    {seatSaving ? "保存中…" : "シートを更新"}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  最低2シート · 現在の使用数（{selectedOrg.seats_used}シート使用中）より減らすことはできません
                </p>

                {/* Seat reduction confirmation */}
                {seatConfirm && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm space-y-2">
                    <p className="font-medium text-amber-800">
                      {selectedOrg.seats_purchased}シートから{seatInput}シートに減らしますか？
                      {seatInput === 1 && " アカウントをProにダウングレードします。"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateSeats}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-500 transition"
                      >
                        削減を確認
                      </button>
                      <button
                        onClick={() => { setSeatConfirm(false); setSeatInput(selectedOrg.seats_purchased); }}
                        className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Invite form */}
          {isAdmin && (
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-semibold text-slate-800">メンバーを招待</h2>
              {inviteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {inviteError}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="メールアドレス"
                  type="email"
                  className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="member">メンバー</option>
                  <option value="admin">管理者</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                >
                  {inviting ? "送信中…" : "招待"}
                </button>
              </div>
              {selectedOrg.seats_used >= selectedOrg.seats_purchased && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> 空きシートがありません。招待する前にシート数を増やしてください。
                </p>
              )}
            </section>
          )}

          {/* Members + Pending invitations */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">{selectedOrg.name} — メンバーと招待</h2>

            {membersLoading ? (
              <p className="text-sm text-slate-400">読み込み中...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-400">まだメンバーがいません。上でチームの最初のメンバーを招待してください。</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {members.map((m) => (
                  <li
                    key={m.type === "member" ? `m-${m.user_id}` : `i-${m.invitation_token}`}
                    className="flex items-center justify-between py-3 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {m.type === "invitation" ? (
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <Mail className="h-4 w-4 text-amber-600" />
                        </div>
                      ) : m.role === "owner" ? (
                        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <Crown className="h-4 w-4 text-purple-600" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-600 text-xs font-bold">
                          {(m.full_name || m.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {m.type === "member" ? (m.full_name || m.email) : m.email}
                        </p>
                        {m.type === "member" && m.full_name && (
                          <p className="text-xs text-slate-400 truncate">{m.email}</p>
                        )}
                        {m.type === "invitation" && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-amber-500" />
                            <span className={`text-xs ${m.expires_soon ? "text-amber-600 font-medium" : "text-slate-400"}`}>
                              招待保留中{m.expires_soon ? " — まもなく期限切れ" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {m.type === "member" && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[m.role] ?? ""}`}>
                          {m.role}
                        </span>
                      )}
                      {m.type === "invitation" && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                          保留中
                        </span>
                      )}

                      {/* Actions */}
                      {m.type === "invitation" && isAdmin && m.invitation_token && (
                        <>
                          <button
                            onClick={() => handleResendInvite(m.invitation_token!)}
                            title="再送"
                            className="p-1 text-slate-400 hover:text-indigo-600 transition"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleCancelInvite(m.invitation_token!)}
                            title="招待をキャンセル"
                            className="p-1 text-slate-400 hover:text-red-600 transition"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {m.type === "member" && isOwner && m.role !== "owner" && m.user_id && (
                        <>
                          <select
                            value={m.role}
                            onChange={(e) => handleChangeRole(m.user_id!, e.target.value as "admin" | "member")}
                            className="text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          >
                            <option value="admin">管理者</option>
                            <option value="member">メンバー</option>
                          </select>
                          {removeConfirm === m.user_id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRemoveMember(m.user_id!)}
                                className="text-xs text-white bg-red-600 px-2 py-0.5 rounded hover:bg-red-700 transition"
                              >
                                確認
                              </button>
                              <button
                                onClick={() => setRemoveConfirm(null)}
                                className="text-xs text-slate-600 border border-slate-300 px-2 py-0.5 rounded hover:bg-slate-50 transition"
                              >
                                キャンセル
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRemoveConfirm(m.user_id!)}
                              title="メンバーを削除"
                              className="p-1 text-slate-400 hover:text-red-600 transition"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => { setTransferTo(m.user_id!); setTransferConfirm(true); }}
                            title="オーナーシップを移転"
                            className="p-1 text-slate-400 hover:text-purple-600 transition"
                          >
                            <Crown className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Transfer ownership confirmation */}
            {transferConfirm && transferTo && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm space-y-3">
                <p className="font-medium text-purple-800">
                  {members.find((m) => m.user_id === transferTo)?.full_name || members.find((m) => m.user_id === transferTo)?.email}にオーナーシップを移転しますか？あなたは管理者になります。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleTransferOwnership}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-500 transition"
                  >
                    移転を確認
                  </button>
                  <button
                    onClick={() => { setTransferConfirm(false); setTransferTo(null); }}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
