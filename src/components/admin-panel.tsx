"use client";

import { useEffect, useState } from "react";

type ConferenceInfo = { id: string; name: string; shortName: string };
type TeamInfo = { id: string; name: string; shortName: string | null; conference: ConferenceInfo };
type UserInfo = { id: string; email: string; firstName: string | null; lastName: string | null; name: string | null; matchedEmail?: string | null };
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
  const [activeTab, setActiveTab] = useState<"draft-order" | "draft-picks" | "team-ownership">("draft-order");

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
          onClick={() => setActiveTab("draft-picks")}
          className={`px-5 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === "draft-picks"
              ? "border-emerald-400 text-white"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Draft Picks
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
      {activeTab === "draft-picks" && <DraftPicksSection leagues={leagues} teams={teams} />}
      {activeTab === "team-ownership" && <TeamOwnershipSection leagues={leagues} teams={teams} />}
    </div>
  );
}

/* ─── DRAFT ORDER SECTION ─────────────────────────────────────────────────── */

function DraftOrderSection({ leagues }: { leagues: LeagueInfo[] }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState(leagues[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
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
      // Always persist freshly computed sequential positions (1..N) based on
      // the current on-screen order, rather than trusting potentially stale
      // or duplicate stored position values. This keeps the draft order
      // self-healing even if prior data ever became corrupted.
      const sorted = [...league.leagueUsers].sort(
        (a, b) => (positions[a.userId] ?? 0) - (positions[b.userId] ?? 0),
      );
      const order = sorted.map((m, index) => ({
        userId: m.userId,
        draftPosition: index + 1,
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

  async function handleResetDraft() {
    if (!league) return;

    const confirmed = window.confirm(
      "Are you absolutely sure you want to reset this draft? This will permanently clear all draft picks and roster assignments for the selected league.",
    );
    if (!confirmed) {
      return;
    }

    setResetting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/reset-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: selectedLeagueId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setFeedback({ type: "ok", msg: data.message ?? "Draft reset successfully." });
    } catch (err: unknown) {
      setFeedback({ type: "err", msg: err instanceof Error ? err.message : "Draft reset failed." });
    } finally {
      setResetting(false);
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
                <td className="px-4 py-3 text-slate-400">{member.user.matchedEmail ?? member.user.email}</td>
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

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSave}
          disabled={saving || resetting}
          className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Draft Order"}
        </button>
        <button
          onClick={handleResetDraft}
          disabled={saving || resetting}
          className="rounded-full bg-red-500 px-6 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
        >
          {resetting ? "Resetting…" : "Reset Draft"}
        </button>
      </div>
    </div>
  );
}

/* ─── DRAFT PICKS (MANUAL CORRECTION) SECTION ────────────────────────────── */

type DraftPickInfo = {
  id: string;
  round: number;
  pickNumber: number;
  pickedAt: string | null;
  user: UserInfo | null;
  team: TeamInfo | null;
};

function DraftPicksSection({ leagues, teams }: { leagues: LeagueInfo[]; teams: TeamInfo[] }) {
  const [selectedLeagueId, setSelectedLeagueId] = useState(leagues[0]?.id ?? "");
  const [picks, setPicks] = useState<DraftPickInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [removingPickId, setRemovingPickId] = useState<string | null>(null);
  const [insertUserId, setInsertUserId] = useState("");
  const [insertTeamId, setInsertTeamId] = useState("");
  const [insertRound, setInsertRound] = useState(1);
  const [insertPickNumber, setInsertPickNumber] = useState(1);
  const [inserting, setInserting] = useState(false);

  const league = leagues.find((l) => l.id === selectedLeagueId);

  async function loadPicks(leagueId: string) {
    if (!leagueId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/picks`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to load picks.");
      setPicks(data);
    } catch (err: unknown) {
      setFeedback({ type: "err", msg: err instanceof Error ? err.message : "Unable to load picks." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedLeagueId) void loadPicks(selectedLeagueId);
  }, [selectedLeagueId]);

  function handleLeagueChange(id: string) {
    setSelectedLeagueId(id);
    setFeedback(null);
    void loadPicks(id);
  }

  async function handleRemovePick(pick: DraftPickInfo) {
    if (!league) return;
    const managerLabel = pick.user ? displayName(pick.user) : "that manager";
    const pickedAtLabel = pick.pickedAt ? new Date(pick.pickedAt).toLocaleString() : "unknown time";
    const confirmed = window.confirm(
      `Remove ${managerLabel}'s Round ${pick.round} pick of ${pick.team?.name ?? "this team"} (made ${pickedAtLabel})? The team will return to the pool.`,
    );
    if (!confirmed) return;

    setRemovingPickId(pick.id);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/draft-correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          remove: [{ pickId: pick.id }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to remove pick.");
      setFeedback({ type: "ok", msg: "Pick removed." });
      await loadPicks(selectedLeagueId);
    } catch (err: unknown) {
      setFeedback({ type: "err", msg: err instanceof Error ? err.message : "Unable to remove pick." });
    } finally {
      setRemovingPickId(null);
    }
  }

  async function handleInsertPick() {
    if (!league || !insertUserId || !insertTeamId) return;

    setInserting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/draft-correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: selectedLeagueId,
          insert: [
            {
              round: insertRound,
              pickNumber: insertPickNumber,
              userId: insertUserId,
              teamId: insertTeamId,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to add pick.");
      if (Array.isArray(data.skipped) && data.skipped.length > 0) {
        throw new Error(data.skipped[0]?.reason ?? "Unable to add pick.");
      }
      setFeedback({ type: "ok", msg: "Pick added." });
      setInsertUserId("");
      setInsertTeamId("");
      await loadPicks(selectedLeagueId);
    } catch (err: unknown) {
      setFeedback({ type: "err", msg: err instanceof Error ? err.message : "Unable to add pick." });
    } finally {
      setInserting(false);
    }
  }

  if (!league) return <p className="text-slate-400">No leagues found.</p>;

  const pickedTeamIds = new Set(picks.map((p) => p.team?.id).filter(Boolean));
  const availableTeams = teams.filter((t) => !pickedTeamIds.has(t.id));

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Manually remove or add a specific draft pick. Use this to correct mistakes (e.g. a pick removed or attributed
        to the wrong manager) without disrupting the rest of the draft board.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">League</label>
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

      {feedback && (
        <p className={`text-sm font-medium ${feedback.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
          {feedback.msg}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Round</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Pick #</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Manager</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Team</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-400">Picked At</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : picks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-slate-400">
                  No picks yet.
                </td>
              </tr>
            ) : (
              picks.map((pick) => (
                <tr key={pick.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">{pick.round}</td>
                  <td className="px-4 py-3">{pick.pickNumber}</td>
                  <td className="px-4 py-3 font-medium">{pick.user ? displayName(pick.user) : "—"}</td>
                  <td className="px-4 py-3">{pick.team?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {pick.pickedAt ? new Date(pick.pickedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => void handleRemovePick(pick)}
                      disabled={removingPickId === pick.id}
                      className="rounded-full border border-red-400/40 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-400/20 disabled:opacity-50"
                    >
                      {removingPickId === pick.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-200">Add a missing pick</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Manager
            </label>
            <select
              value={insertUserId}
              onChange={(e) => setInsertUserId(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select manager…</option>
              {league.leagueUsers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {displayName(m.user)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">Team</label>
            <select
              value={insertTeamId}
              onChange={(e) => setInsertTeamId(e.target.value)}
              className="min-w-[12rem] rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select team…</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">Round</label>
            <input
              type="number"
              min="1"
              value={insertRound}
              onChange={(e) => setInsertRound(Number(e.target.value) || 1)}
              className="w-20 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
              Pick #
            </label>
            <input
              type="number"
              min="1"
              value={insertPickNumber}
              onChange={(e) => setInsertPickNumber(Number(e.target.value) || 1)}
              className="w-20 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={() => void handleInsertPick()}
            disabled={inserting || !insertUserId || !insertTeamId}
            className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {inserting ? "Adding…" : "Add Pick"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Pick # refers to the draft position of the manager selected above (matches the &quot;Pick&quot; number shown
          in Draft Order).
        </p>
      </div>
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

      <div className="border-t border-white/10 pt-6">
        <AddTeamSection teams={teams} />
      </div>
    </div>
  );
}

/* ─── ADD TEAM SECTION ────────────────────────────────────────────────────── */

function AddTeamSection({ teams }: { teams: TeamInfo[] }) {
  const conferences = Array.from(
    new Map(teams.map((t) => [t.conference.id, t.conference])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const [name, setName] = useState("");
  const [conferenceId, setConferenceId] = useState("");
  const [isFcs, setIsFcs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  async function handleAddTeam() {
    if (!name.trim() || !conferenceId) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/add-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), conferenceId, isFcs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setFeedback({ type: "ok", msg: `${data.team.name} was added successfully. Reloading…` });
      setName("");
      setConferenceId("");
      setIsFcs(false);
      setTimeout(() => window.location.reload(), 800);
    } catch (err: unknown) {
      setFeedback({ type: "err", msg: err instanceof Error ? err.message : "Failed to add team." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-sky-400">
        Add a Missing Team
      </h3>
      <p className="text-sm text-slate-400">
        Use this if a school is missing from the draft/roster team dropdowns (e.g. a naming gap
        during initial setup).
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
            Team name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ole Miss"
            className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">
            Conference
          </label>
          <select
            value={conferenceId}
            onChange={(e) => setConferenceId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">— Select conference —</option>
            {conferences.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={isFcs} onChange={(e) => setIsFcs(e.target.checked)} />
          FCS
        </label>

        <button
          onClick={handleAddTeam}
          disabled={saving || !name.trim() || !conferenceId}
          className="rounded-full bg-sky-500 px-6 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-40"
        >
          {saving ? "Adding…" : "Add Team"}
        </button>
      </div>

      {feedback && (
        <p className={`text-sm font-medium ${feedback.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
          {feedback.msg}
        </p>
      )}
    </div>
  );
}
