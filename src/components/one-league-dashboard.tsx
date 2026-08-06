'use client';

import { type FormEvent, useEffect, useState } from "react";

type League = {
  id: string;
  name: string;
  season: { year: number };
  settings?: {
    rosterRequirements?: Array<{ slot: string; count: number }>;
  } | null;
  leagueUsers: Array<{
    id: string;
    draftPosition?: number | null;
    user: {
      id: string;
      email: string;
      name?: string | null;
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
  user?: { name?: string | null; email: string } | null;
  team?: Team | null;
};

function toDisplaySlot(slot: string) {
  return slot
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function OneLeagueDashboard() {
  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [draftPosition, setDraftPosition] = useState("1");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    if (league?.leagueUsers?.length) {
      setSelectedMemberId((current) => current || league.leagueUsers[0].user.id);
    }
  }, [league]);

  useEffect(() => {
    if (teams.length && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  async function loadDashboard() {
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
        const createResponse = await fetch("/api/leagues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "College Football Fantasy League",
            ownerEmail: "owner@league.local",
          }),
        });

        if (!createResponse.ok) {
          throw new Error("Unable to create the league.");
        }

        const createdLeague = await createResponse.json();
        setLeague(createdLeague);
        setSelectedMemberId("");
        setSelectedTeamId("");
      } else {
        setLeague(activeLeague);
      }

      const teamsResponse = await fetch("/api/teams");
      if (!teamsResponse.ok) {
        throw new Error("Unable to load teams.");
      }
      const teamsPayload = await teamsResponse.json();
      setTeams(Array.isArray(teamsPayload) ? teamsPayload : []);

      const activeLeagueId = activeLeague?.id ?? (await fetch("/api/leagues").then((response) => response.json()).then((payload) => (Array.isArray(payload) ? payload[0]?.id : null)));
      if (!activeLeagueId) {
        setPicks([]);
        return;
      }

      const picksResponse = await fetch(`/api/leagues/${activeLeagueId}/picks`);
      if (!picksResponse.ok) {
        throw new Error("Unable to load picks.");
      }
      const picksPayload = await picksResponse.json();
      setPicks(Array.isArray(picksPayload) ? picksPayload : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!league) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/leagues/${league.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: memberEmail,
          draftPosition: Number(draftPosition) || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to add member.");
      }

      setMemberEmail("");
      setDraftPosition("1");
      await loadDashboard();
      setMessage(`Added ${payload.user.email} to the league.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add member.");
    } finally {
      setSubmitting(false);
    }
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
        body: JSON.stringify({
          userId: selectedMemberId,
          teamId: selectedTeamId,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit draft pick.");
      }

      await loadDashboard();
      setMessage("Recorded draft pick.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit draft pick.");
    } finally {
      setSubmitting(false);
    }
  }

  const requirements = league?.settings?.rosterRequirements ?? [
    { slot: "BIG_TEN", count: 1 },
    { slot: "BIG_TWELVE", count: 1 },
    { slot: "SEC", count: 1 },
    { slot: "ACC", count: 1 },
    { slot: "GROUP_OF_FIVE", count: 2 },
    { slot: "FCS", count: 2 },
    { slot: "WILDCARD", count: 2 },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1f2937,_#020617)] px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="border-b border-white/10 bg-slate-950/60 px-6 py-8 sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              Single-league fantasy service
            </p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
              {league?.name ?? "College Football Fantasy League"}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
              The experience is tailored for one active league. Create members, track draft picks, and review the
              roster rules without switching between multiple leagues.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1">
                Season {league?.season?.year ?? new Date().getFullYear()}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {league?.leagueUsers?.length ?? 0} members
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {picks.length} picks submitted
              </span>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Roster requirements</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {requirements.map((requirement) => (
                    <div key={requirement.slot} className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3">
                      <p className="text-sm font-medium text-white">{toDisplaySlot(requirement.slot)}</p>
                      <p className="mt-1 text-sm text-slate-400">{requirement.count} required</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Add a league member</h2>
                <form onSubmit={handleAddMember} className="mt-4 space-y-3">
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Email
                    <input
                      className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none ring-0"
                      value={memberEmail}
                      onChange={(event) => setMemberEmail(event.target.value)}
                      placeholder="member@example.com"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Draft position
                    <input
                      className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none ring-0"
                      type="number"
                      min="1"
                      value={draftPosition}
                      onChange={(event) => setDraftPosition(event.target.value)}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={submitting || !memberEmail.trim()}
                    className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {submitting ? "Adding..." : "Add member"}
                  </button>
                </form>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Submit a draft pick</h2>
                  <button
                    type="button"
                    onClick={() => void loadDashboard()}
                    className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                  >
                    Refresh
                  </button>
                </div>
                <form onSubmit={handleSubmitPick} className="mt-4 space-y-3">
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Member
                    <select
                      className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                    >
                      {league?.leagueUsers?.map((entry) => (
                        <option key={entry.user.id} value={entry.user.id}>
                          {entry.user.name ?? entry.user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-300">
                    Team
                    <select
                      className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white outline-none"
                      value={selectedTeamId}
                      onChange={(event) => setSelectedTeamId(event.target.value)}
                    >
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} {team.conference?.name ? `(${team.conference.name})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={submitting || !selectedMemberId || !selectedTeamId}
                    className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {submitting ? "Saving..." : "Submit pick"}
                  </button>
                </form>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Draft board</h2>
                {loading ? (
                  <p className="mt-4 text-sm text-slate-400">Loading draft data...</p>
                ) : picks.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">No picks yet. The first submission will appear here.</p>
                ) : (
                  <ol className="mt-4 space-y-2">
                    {picks.map((pick) => (
                      <li key={pick.id} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-white">
                            {pick.team?.name ?? "Team pending"}
                          </span>
                          <span className="text-slate-400">R{pick.round} P{pick.pickNumber}</span>
                        </div>
                        <p className="mt-1 text-slate-400">
                          {pick.user?.name ?? pick.user?.email ?? "Member pending"}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {message}
          </div>
        ) : null}
      </div>
    </main>
  );
}
