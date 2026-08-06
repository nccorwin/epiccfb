'use client';

import { type FormEvent, useEffect, useMemo, useState } from "react";

export type DraftPageUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
};

type League = {
  id: string;
  name: string;
  leagueUsers: Array<{
    id: string;
    draftPosition?: number | null;
    user: {
      id: string;
      email: string;
      name?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      username?: string | null;
    };
  }>;
};

type Team = {
  id: string;
  name: string;
  shortName?: string | null;
  conference?: { name?: string | null } | null;
  isFcs?: boolean | null;
};

type DraftPick = {
  id: string;
  round: number;
  pickNumber: number;
  user?: { id: string; name?: string | null; email: string } | null;
  team?: Team | null;
};

const draftRequirements = [
  { label: "Big Ten", slot: "BIG_TEN", count: 1 },
  { label: "Big 12", slot: "BIG_TWELVE", count: 1 },
  { label: "SEC", slot: "SEC", count: 1 },
  { label: "ACC", slot: "ACC", count: 1 },
  { label: "Group of 5", slot: "GROUP_OF_FIVE", count: 2 },
  { label: "FCS", slot: "FCS", count: 2 },
  { label: "Wildcard", slot: "WILDCARD", count: 2 },
];

function formatTimeLeft(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function getTeamSlot(team: Team) {
  const conferenceName = (team.conference?.name ?? "").toLowerCase();
  if (team.isFcs) return "FCS";
  if (conferenceName.includes("big ten") || conferenceName.includes("big 10")) return "BIG_TEN";
  if (conferenceName.includes("big 12")) return "BIG_TWELVE";
  if (conferenceName.includes("sec")) return "SEC";
  if (conferenceName.includes("acc")) return "ACC";
  if (conferenceName.includes("mac") || conferenceName.includes("mountain west") || conferenceName.includes("sun belt") || conferenceName.includes("pac") || conferenceName.includes("pac-12")) return "GROUP_OF_FIVE";
  return "WILDCARD";
}

export default function DraftPage({ currentUser }: { currentUser: DraftPageUser }) {
  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState(currentUser.id);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [draftOrder, setDraftOrder] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void loadDraftData();
  }, []);

  useEffect(() => {
    if (!deadline) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (league?.leagueUsers.length) {
      setSelectedMemberId((current) => current || league.leagueUsers[0].user.id);
    }
  }, [league]);

  useEffect(() => {
    if (teams.length && !selectedTeamId) {
      setSelectedTeamId(teams[0]?.id ?? "");
    }
  }, [teams, selectedTeamId]);

  async function loadDraftData() {
    setLoading(true);
    setMessage(null);

    try {
      const leagueResponse = await fetch("/api/leagues");
      if (!leagueResponse.ok) {
        throw new Error("Unable to load the league.");
      }
      const leaguePayload = await leagueResponse.json();
      const activeLeague = Array.isArray(leaguePayload) ? leaguePayload[0] : null;
      if (!activeLeague) {
        throw new Error("No active league was found.");
      }
      setLeague(activeLeague);
      setDraftOrder(
        Object.fromEntries(
          (activeLeague.leagueUsers ?? []).map((entry: { user: { id: string }; draftPosition?: number | null }) => [entry.user.id, entry.draftPosition ?? 1]),
        ),
      );

      const teamsResponse = await fetch("/api/teams");
      if (!teamsResponse.ok) {
        throw new Error("Unable to load teams.");
      }
      const teamsPayload = await teamsResponse.json();
      setTeams(Array.isArray(teamsPayload) ? teamsPayload : []);

      const picksResponse = await fetch(`/api/leagues/${activeLeague.id}/picks`);
      if (!picksResponse.ok) {
        throw new Error("Unable to load picks.");
      }
      const picksPayload = await picksResponse.json();
      setPicks(Array.isArray(picksPayload) ? picksPayload : []);
      setDeadline(Date.now() + 72 * 60 * 60 * 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load draft data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDraftOrderUpdate(memberId: string, draftPosition: number) {
    if (!league) return;

    const response = await fetch(`/api/leagues/${league.id}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftPosition }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error ?? "Unable to update the draft order.");
      return;
    }

    setDraftOrder((current) => ({ ...current, [memberId]: draftPosition }));
    setMessage("Draft order updated.");
    await loadDraftData();
  }

  async function handleSubmitPick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!league) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/leagues/${league.id}/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedMemberId, teamId: selectedTeamId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit pick.");
      }

      await loadDraftData();
      setDeadline(Date.now() + 72 * 60 * 60 * 1000);
      setMessage("Draft pick submitted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit pick.");
    } finally {
      setSubmitting(false);
    }
  }

  const sortedMembers = useMemo(() => {
    if (!league?.leagueUsers?.length) return [];
    return [...league.leagueUsers].sort((left, right) => {
      const leftPosition = draftOrder[left.user.id] ?? left.draftPosition ?? 1;
      const rightPosition = draftOrder[right.user.id] ?? right.draftPosition ?? 1;
      return leftPosition - rightPosition;
    });
  }, [draftOrder, league]);

  const roundCount = Math.max(10, Math.ceil((picks.length + 1) / Math.max(sortedMembers.length, 1)) + 1);
  const availableTeams = teams.filter((team) => !picks.some((pick) => pick.team?.id === team.id));

  const userPicks = picks.filter((pick) => pick.user?.id === currentUser.id);
  const completedCriteria = draftRequirements.map((requirement) => {
    const count = userPicks.filter((pick) => getTeamSlot(pick.team as Team) === requirement.slot).length;
    return { ...requirement, satisfied: count >= requirement.count };
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">2026 draft board</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Draft clock and board</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              This draft uses a 72-hour turn clock per selection. The board below is auto-populated as picks are submitted.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Clock</p>
            <p className="mt-2 text-3xl font-semibold text-white">{deadline ? formatTimeLeft(deadline - now) : "--:--:--"}</p>
            <p className="mt-1 text-sm text-slate-300">Next pick window</p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Draft order</h3>
              <p className="mt-1 text-sm text-slate-400">Set the manual order before the draft starts.</p>
            </div>
            <button type="button" onClick={() => void loadDraftData()} className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">
              Refresh
            </button>
          </div>
          <div className="mt-6 space-y-3">
            {sortedMembers.map((entry) => (
              <div key={entry.user.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white">{entry.user.name ?? entry.user.email}</p>
                  <p className="text-sm text-slate-400">{entry.user.username ?? entry.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-300">Pick</label>
                  <input
                    type="number"
                    min="1"
                    className="w-20 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white"
                    value={draftOrder[entry.user.id] ?? entry.draftPosition ?? 1}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value || 1);
                      setDraftOrder((current) => ({ ...current, [entry.user.id]: nextValue }));
                    }}
                  />
                  <button type="button" onClick={() => void handleDraftOrderUpdate(entry.user.id, draftOrder[entry.user.id] ?? entry.draftPosition ?? 1)} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950">
                    Save
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <h3 className="text-xl font-semibold text-white">Submit a pick</h3>
          <form onSubmit={handleSubmitPick} className="mt-5 space-y-4">
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              <span>Manager</span>
              <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white">
                {sortedMembers.map((entry) => (
                  <option key={entry.user.id} value={entry.user.id}>
                    {entry.user.name ?? entry.user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-300">
              <span>Team</span>
              <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white">
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} {team.conference?.name ? `(${team.conference.name})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={submitting || !selectedTeamId} className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700">
              {submitting ? "Submitting..." : "Submit pick"}
            </button>
          </form>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="text-lg font-semibold text-white">Your draft checklist</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {completedCriteria.map((criterion) => (
                <li key={criterion.slot} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2">
                  <span className={criterion.satisfied ? "line-through text-slate-500" : "text-slate-200"}>{criterion.label}</span>
                  <span className="text-slate-400">{criterion.satisfied ? "Done" : "Pending"}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30">
        <div className="border-b border-white/10 bg-slate-950/60 px-6 py-5">
          <h3 className="text-xl font-semibold text-white">Draft board</h3>
          <p className="mt-2 text-sm text-slate-400">Rows represent rounds and columns represent the draft order.</p>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading draft board...</div>
        ) : (
          <div className="overflow-x-auto p-6">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm text-slate-200">
              <thead>
                <tr>
                  <th className="rounded-l-xl border border-white/10 bg-white/5 px-4 py-3 text-left">Round</th>
                  {sortedMembers.map((entry) => (
                    <th key={entry.user.id} className="border border-white/10 bg-white/5 px-4 py-3 text-left">
                      {entry.user.name ?? entry.user.email}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: roundCount }).map((_, roundIndex) => {
                  const round = roundIndex + 1;
                  const order = round % 2 === 1 ? sortedMembers : [...sortedMembers].reverse();
                  return (
                    <tr key={round}>
                      <td className="rounded-l-xl border border-white/10 bg-slate-950/70 px-4 py-3 font-medium text-white">{round}</td>
                      {order.map((entry) => {
                        const pick = picks.find((candidate) => candidate.round === round && candidate.pickNumber === order.indexOf(entry) + 1);
                        return (
                          <td key={`${round}-${entry.user.id}`} className="border border-white/10 bg-slate-950/70 px-4 py-3">
                            {pick?.team ? `${pick.team.name}` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
