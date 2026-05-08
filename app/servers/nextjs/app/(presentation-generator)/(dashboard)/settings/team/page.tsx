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
  admin: "bg-violet-100 text-violet-700",
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
      toast.error("Failed to load team details");
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
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      const detail = e.message || "Failed to send invite";
      if (detail.includes("seats_full") || detail.includes("seats are in use")) {
        setInviteError("All seats are in use. Add more seats below before inviting.");
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
      toast.success("Member removed");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "Failed to remove member");
    }
  };

  const handleCancelInvite = async (token: string) => {
    if (!selectedOrg) return;
    try {
      await api.delete(`/api/v1/org/${selectedOrg.slug}/invitations/${token}`);
      toast.success("Invitation cancelled");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "Failed to cancel invitation");
    }
  };

  const handleResendInvite = async (token: string) => {
    if (!selectedOrg) return;
    try {
      await api.post(`/api/v1/org/${selectedOrg.slug}/invitations/${token}/resend`);
      toast.success("Invitation resent");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "Failed to resend invitation");
    }
  };

  const handleUpdateSeats = async () => {
    if (!selectedOrg) return;
    setSeatSaving(true);
    setSeatConfirm(false);
    try {
      await api.patch(`/api/v1/org/${selectedOrg.slug}/seats`, { seats: seatInput });
      toast.success(`Seats updated to ${seatInput}`);
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "Failed to update seats");
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
      toast.success("Ownership transferred");
      setTransferTo(null);
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "Failed to transfer ownership");
    }
  };

  const handleChangeRole = async (userId: number, role: "admin" | "member") => {
    if (!selectedOrg) return;
    try {
      await api.patch(`/api/v1/org/${selectedOrg.slug}/members/${userId}/role`, { role });
      toast.success("Role updated");
      await loadOrg(selectedOrg.slug);
    } catch (e: any) {
      toast.error(e.message || "Failed to change role");
    }
  };

  if (loading) return <div className="p-8 text-slate-500 text-sm">Loading…</div>;

  const isOwner = selectedOrg?.role === "owner";
  const isAdmin = selectedOrg?.role === "admin" || isOwner;
  const seatPct = selectedOrg ? Math.min(100, ((selectedOrg.seats_used) / selectedOrg.seats_purchased) * 100) : 0;
  const seatColor = seatPct >= 100 ? "bg-red-500" : seatPct >= 80 ? "bg-amber-400" : "bg-violet-500";

  return (
    <div className="max-w-3xl mx-auto px-8 py-10 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Team</h1>

      {/* Org selector */}
      {orgs.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-slate-800">Your organizations</h2>
          <div className="space-y-2">
            {orgs.map((o) => (
              <button
                key={o.id}
                onClick={() => loadOrg(o.slug)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition ${
                  selectedOrg?.slug === o.slug ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-slate-300 bg-white"
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
          <h2 className="font-semibold text-slate-800">No team yet</h2>
          <p className="text-sm text-slate-500">You&apos;re on the{" "}
            <strong>{/* user plan from billing */}</strong> plan. Upgrade to Team to invite colleagues and collaborate on presentations.
          </p>
          <a href="/settings/billing" className="inline-block px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-500 transition">
            Upgrade to Team
          </a>
        </section>
      )}

      {/* Org details */}
      {selectedOrg && (
        <>
          {/* Seat usage bar */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Seats</h2>
              <span className="text-sm text-slate-500">
                {selectedOrg.seats_used} of {selectedOrg.seats_purchased} used
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${seatColor}`} style={{ width: `${seatPct}%` }} />
            </div>
            {seatPct >= 100 && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> All seats are in use. Add more seats to invite additional members.
              </p>
            )}
            {seatPct >= 80 && seatPct < 100 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Only {selectedOrg.seats_purchased - selectedOrg.seats_used} seat(s) remaining.
              </p>
            )}

            {/* Seat adjustment (owner only) */}
            {isOwner && (
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <p className="text-sm font-medium text-slate-700">Adjust seats</p>
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
                    className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                  >
                    {seatSaving ? "Saving…" : "Update seats"}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Minimum 2 seats · Cannot reduce below current usage ({selectedOrg.seats_used} seats in use)
                </p>

                {/* Seat reduction confirmation */}
                {seatConfirm && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm space-y-2">
                    <p className="font-medium text-amber-800">
                      Reduce from {selectedOrg.seats_purchased} → {seatInput} seats?
                      {seatInput === 1 && " This will downgrade your account to Pro."}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateSeats}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-500 transition"
                      >
                        Confirm reduction
                      </button>
                      <button
                        onClick={() => { setSeatConfirm(false); setSeatInput(selectedOrg.seats_purchased); }}
                        className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition"
                      >
                        Cancel
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
              <h2 className="font-semibold text-slate-800">Invite member</h2>
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
                  placeholder="Email address"
                  type="email"
                  className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                >
                  {inviting ? "Sending…" : "Invite"}
                </button>
              </div>
              {selectedOrg.seats_used >= selectedOrg.seats_purchased && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> No seats available. Increase seat count above before inviting.
                </p>
              )}
            </section>
          )}

          {/* Members + Pending invitations */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">{selectedOrg.name} — Members & Invitations</h2>

            {membersLoading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-slate-400">No members yet. Invite your first team member above.</p>
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
                              Invitation pending{m.expires_soon ? " — expires soon" : ""}
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
                          Pending
                        </span>
                      )}

                      {/* Actions */}
                      {m.type === "invitation" && isAdmin && m.invitation_token && (
                        <>
                          <button
                            onClick={() => handleResendInvite(m.invitation_token!)}
                            title="Resend"
                            className="p-1 text-slate-400 hover:text-violet-600 transition"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleCancelInvite(m.invitation_token!)}
                            title="Cancel invite"
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
                            className="text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>
                          {removeConfirm === m.user_id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRemoveMember(m.user_id!)}
                                className="text-xs text-white bg-red-600 px-2 py-0.5 rounded hover:bg-red-700 transition"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setRemoveConfirm(null)}
                                className="text-xs text-slate-600 border border-slate-300 px-2 py-0.5 rounded hover:bg-slate-50 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setRemoveConfirm(m.user_id!)}
                              title="Remove member"
                              className="p-1 text-slate-400 hover:text-red-600 transition"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => { setTransferTo(m.user_id!); setTransferConfirm(true); }}
                            title="Transfer ownership"
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
                  Transfer ownership to {members.find((m) => m.user_id === transferTo)?.full_name || members.find((m) => m.user_id === transferTo)?.email}?
                  You will become an admin.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleTransferOwnership}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-500 transition"
                  >
                    Confirm transfer
                  </button>
                  <button
                    onClick={() => { setTransferConfirm(false); setTransferTo(null); }}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition"
                  >
                    Cancel
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
