"use client";

import { useState } from "react";

type ConferenceInfo = { id: string; name: string; shortName: string };
type TeamInfo = { id: string; name: string; shortName: string | null; conference: ConferenceInfo };
type UserInfo = { id: string; email: string; firstName: string | null; lastName: string | null; name: string | null };
type LeagueMember = { id: string; userId: string; draftPosition: number | null; user: UserInfo };
type LeagueInfo = { id: string; name: string; leagueUsers: LeagueMember[] };

interface AdminPanelProps {
  leagues: LeagueInfo[];
  teams: TeamInfo[];
}

function displayName(u: UserInfo): string {
  if (u.firstName || u.lastName) return [u.firstName, u.lastName].filter(Boolean).join(" ");
  return u.name ?? u.email;
}

export default function AdminPanel({ leagues, teams }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"draft-order" | "team-ownership">("draft-order");

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
          Admin
        </span>
        <h2 className="text-2xl font-semibold">Administration Panel</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        <button
          onClick={() => setActiveTab("draft-order")}
          className={`px-5 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "draft-order"
              ? "border-emerald-400 text-white"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Draft Order
        </button>
        <button
          onClick={() => setActiveTab("team-ownership")}
          className={`px-5 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "team-ownership"
              ? "border-emerald-400 text-white"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Team Ownership
        </button>
      </div>

      {activeTab === "draft-order" && <DraftOrderSection leagues={leagues} />}
      {activeTab === "team-ownership" && <TeamOwnershipSection leagues={leagues} teams={teams} />}
    </div>
  );
}

/* ─── DRAFT ORDER SECTION ─────────────────────────────────────────────────── */

function DraftOrderSection({ leagues }: { leagues: LeagueInfo[] }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState(leagues[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const league = leagues.find((l) => l.id === selectedLeagueId);

  // Local editable positions
  const [positions, setPositions] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    league?.leagueUsers.forEach((m) => {
      map[m.userId] = m.draftPosition ?? 0;
    });
    return map;
  });

  // When league changes, reset positions
  function handleLeagueChange(id: string) {
    setSelectedLeagueId(id);
    const newLeague = leagues.find((l) => l.id === id);
    const map: Record<string, number> = {};
    newLeague?.leagueUsers.forEach((m) => {
      map[m.userId] = m.draftPosition ?? 0;
    });
    setPositions(map);
    setFeedback(null);
  }

  // Move a member up or down in draft order
  function move(userId: string, dir: -1 | 1) {
    if (!league) return;
    const sorted = [...league.leagueUsers].sort(
      (a, b) => (positions[a.userId] ?? 0) - (positions[b.userId] ?? 0),
    );
    const idx = sorted.findIndex((m) => m.userId === userId);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const posA = positions[sorted[idx].userId];
    const posB = positions[sorted[swapIdx].userId];
    setPositions((prev) => ({
      ...prev,
      [sorted[idx].userId]: posB,
      [sorted[swapIdx].userId]: posA,
    }));
  }

  async function handleSave() {
    if (!league) return;
    setSaving(true);
    setFeedback(null);
    try {
      const order = league.leagueUsers.map((m) => ({
        userId: m.userId,
        draftPosition: positions[m.userId] ?? 0,
      }));
      const res = await fetch("/api/admin/draft-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: selectedLeagueId, order }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setFeedback({ type: "ok", msg: "Draft order saved successfully." });
    } catch (err: unknown) {
      setFeedback({ type: "err", msg: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  if (!league) {
    return <p className="text-slate-400">No leagues found.</p>;
  }

  const sortedMembers = [...league.leagueUsers].sort(
    (a, b) => (positions[a.userId] ?? 0) - (positions[b.userId] ?? 0),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
            League
          </label>
          <select
            value={selectedLeagueId}
            onChange={(e) => handleLeagueChange(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Pick #</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Manager</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Email</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-400">Reorder</th>
            </tr>
          </thead>
          <tbody>
            {sortedMembers.map((member, i) => (
              <tr key={member.userId} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-emerald-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{displayName(member.user)}</td>
                <td className="px-4 py-3 text-slate-400">{member.user.email}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => move(member.userId, -1)}
                      disabled={i === 0}
                      className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10 disabled:opacity-30"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(member.userId, 1)}
                      disabled={i === sortedMembers.length - 1}
                      className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-white/10 disabled:opacity-30"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {feedback && (
        <p
          className={`text-sm font-medium ${feedback.type === "ok" ? "text-emerald-400" : "text-red-400"}`}
        >
          {feedback.msg}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Draft Order"}
      </button>
    </div>
  );
}

/* ─── TEAM OWNERSHIP SECTION ──────────────────────────────────────────────── */

function TeamOwnershipSection({ leagues, teams }: { leagues: LeagueInfo[]; teams: TeamInfo[] }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState(leagues[0]?.id ?? "");
  const [fromUserId, setFromUserId] = useState("");
  const [dropTeamId, setDropTeamId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [pickupTeamId, setPickupTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const league = leagues.find((l) => l.id === selectedLeagueId);

  function handleLeagueChange(id: string) {
    setSelectedLeagueId(id);
    setFromUserId("");
    setDropTeamId("");
    setToUserId("");
    setPickupTeamId("");
    setFeedback(null);
  }

  async function handleTransfer() {
    if (!fromUserId || !dropTeamId || !toUserId || !pickupTeamId) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/transfer-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          fromUserId,
          toUserId,
          dropTeamId,
          pickupTeamId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setFeedback({ type: "ok", msg: "Team ownership updated successfully." });
      setFromUserId("");
      setDropTeamId("");
      setToUserId("");
      setPickupTeamId("");
    } catch (err: unknown) {
      setFeedback({ type: "err", msg: err instanceof Error ? err.message : "Transfer failed." });
    } finally {
      setSaving(false);
    }
  }

  if (!league) return <p className="text-slate-400">No leagues found.</p>;

  const members = league.leagueUsers;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Use this form to drop a team from one manager&apos;s roster and assign a replacement to any manager.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
            League
          </label>
          <select
            value={selectedLeagueId}
            onChange={(e) => handleLeagueChange(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Drop side */}
        <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/50 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400">Drop</h3>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Manager losing team
            </label>
            <select
              value={fromUserId}
              onChange={(e) => { setFromUserId(e.target.value); setDropTeamId(""); }}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Select manager —</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {displayName(m.user)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Team to drop
            </label>
            <select
              value={dropTeamId}
              onChange={(e) => setDropTeamId(e.target.value)}
              disabled={!fromUserId}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-40"
            >
              <option value="">— Select team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.shortName ?? t.conference.shortName})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Add side */}
        <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/50 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">Add</h3>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Manager receiving team
            </label>
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Select manager —</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {displayName(m.user)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Team to add
            </label>
            <select
              value={pickupTeamId}
              onChange={(e) => setPickupTeamId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Select team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.shortName ?? t.conference.shortName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {feedback && (
        <p
          className={`text-sm font-medium ${feedback.type === "ok" ? "text-emerald-400" : "text-red-400"}`}
        >
          {feedback.msg}
        </p>
      )}

      <button
        onClick={handleTransfer}
        disabled={saving || !fromUserId || !dropTeamId || !toUserId || !pickupTeamId}
        className="rounded-full bg-amber-500 px-6 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40"
      >
        {saving ? "Transferring…" : "Execute Transfer"}
      </button>
    </div>
  );
}
