'use client';

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { findLikelyManagerMatch } from "@/lib/manager-name-match";
import {
  resolveSlotTypeForSelection,
  type DraftSlotType,
} from "@/lib/draft-slot-logic";

export type DraftPageUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  role: "ADMIN" | "MANAGER";
};

type LeagueUser = {
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
};

type League = {
  id: string;
  name: string;
  settings?: {
    draftStatus?: string;
    currentPickStartedAt?: string | null;
  } | null;
  leagueUsers: LeagueUser[];
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
  pickedAt?: string | null;
  user?: { id: string; name?: string | null; email: string } | null;
  team?: Team | null;
};

type DraftStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";

const DRAFT_ROUNDS = 10;
const PICK_WINDOW_MS = 48 * 60 * 60 * 1000;

const draftRequirements = [
  { label: "Big Ten", slot: "BIG_TEN", count: 1 },
  { label: "Big 12", slot: "BIG_TWELVE", count: 1 },
  { label: "SEC", slot: "SEC", count: 1 },
  { label: "ACC", slot: "ACC", count: 1 },
  { label: "Group of 5", slot: "GROUP_OF_FIVE", count: 2 },
  { label: "FCS", slot: "FCS", count: 2 },
  { label: "Wildcard", slot: "WILDCARD", count: 2 },
];
type DraftSlot = DraftSlotType;

function formatTimeLeft(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function resolveTeamSlot(team: Team, existingSelections: Array<{ slotType: DraftSlot; team: Team }>): DraftSlot {
  return resolveSlotTypeForSelection(team, existingSelections);
}

function getDraftStatus(league: League | null): DraftStatus {
  const rawStatus = league?.settings?.draftStatus ?? "NOT_STARTED";
  if (rawStatus === "IN_PROGRESS" || rawStatus === "PAUSED" || rawStatus === "COMPLETED") {
    return rawStatus;
  }
  return "NOT_STARTED";
}

function getCurrentPickStartedAt(league: League | null): string | null {
  return typeof league?.settings?.currentPickStartedAt === "string" ? league.settings.currentPickStartedAt : null;
}

function getPickerForPickIndex(pickIndex: number, sortedMembers: LeagueUser[]) {
  if (sortedMembers.length === 0) {
    return null;
  }

  const round = Math.floor(pickIndex / sortedMembers.length) + 1;
  const pickWithinRound = pickIndex % sortedMembers.length;
  const roundOrder = round % 2 === 1 ? sortedMembers : [...sortedMembers].reverse();
  return roundOrder[pickWithinRound] ?? null;
}

function getMemberDisplayName(member: LeagueUser["user"]) {
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
  return fullName || member.name || member.email;
}

export default function DraftPage({ currentUser }: { currentUser: DraftPageUser }) {
  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [draftOrder, setDraftOrder] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const isAdmin = currentUser.role === "ADMIN";

  useEffect(() => {
    void loadDraftData();
  }, []);

  async function loadDraftData(options?: { soft?: boolean }) {
    if (!options?.soft) {
      setLoading(true);
      setMessage(null);
    }

    try {
      const leagueResponse = await fetch("/api/leagues");
      if (!leagueResponse.ok) {
        throw new Error("Unable to load the league.");
      }
      const leaguePayload = await leagueResponse.json();
      const activeLeague = (Array.isArray(leaguePayload) ? leaguePayload[0] : null) as League | null;
      if (!activeLeague) {
        throw new Error("No active league was found.");
      }
      setLeague(activeLeague);
      setDraftOrder(
        Object.fromEntries(
          (activeLeague.leagueUsers ?? []).map((entry) => [entry.user.id, entry.draftPosition ?? 1]),
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load draft data.");
    } finally {
      if (!options?.soft) {
        setLoading(false);
      }
    }
  }

  const sortedMembers = useMemo(() => {
    if (!league?.leagueUsers?.length) return [];
    return [...league.leagueUsers].sort((left, right) => {
      const leftPosition = draftOrder[left.user.id] ?? left.draftPosition ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = draftOrder[right.user.id] ?? right.draftPosition ?? Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition;
    });
  }, [draftOrder, league]);

  const matchedLeagueMember = useMemo(() => {
    return findLikelyManagerMatch(
      {
        userId: currentUser.id,
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        displayName: currentUser.name,
      },
      sortedMembers.map((member) => ({
        ...member,
        userId: member.user.id,
        email: member.user.email,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        displayName: member.user.name,
      })),
    );
  }, [currentUser.email, currentUser.firstName, currentUser.id, currentUser.lastName, currentUser.name, sortedMembers]);

  const currentManagerUserId = matchedLeagueMember?.user.id ?? currentUser.id;
  const currentManagerUserIds = useMemo(
    () => Array.from(new Set([currentUser.id, matchedLeagueMember?.user.id].filter((value): value is string => Boolean(value)))),
    [currentUser.id, matchedLeagueMember?.user.id],
  );

  const draftStatus = getDraftStatus(league);
  const currentPickStartedAt = getCurrentPickStartedAt(league);
  const userCount = sortedMembers.length;
  const totalPickCount = userCount * DRAFT_ROUNDS;
  const pickCount = picks.length;
  const draftIsComplete = draftStatus === "COMPLETED" || (totalPickCount > 0 && pickCount >= totalPickCount);
  const activePickOwner =
    draftStatus === "IN_PROGRESS" && !draftIsComplete
      ? getPickerForPickIndex(pickCount, sortedMembers)
      : null;
  const isMyTurn = activePickOwner?.user.id === currentManagerUserId;
  const deadlineAt =
    draftStatus === "IN_PROGRESS" && currentPickStartedAt
      ? new Date(currentPickStartedAt).getTime() + PICK_WINDOW_MS
      : null;

  useEffect(() => {
    if (!deadlineAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [deadlineAt]);

  useEffect(() => {
    if (draftStatus !== "IN_PROGRESS") {
      return;
    }

    const poller = window.setInterval(() => {
      void loadDraftData({ soft: true });
    }, 30000);

    return () => window.clearInterval(poller);
  }, [draftStatus]);

  const availableTeams = useMemo(() => {
    const pickedTeamIds = new Set(picks.map((pick) => pick.team?.id).filter((id): id is string => Boolean(id)));
    return teams
      .filter((team) => !pickedTeamIds.has(team.id))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [picks, teams]);
  const effectiveSelectedTeamId =
    selectedTeamId && availableTeams.some((team) => team.id === selectedTeamId)
      ? selectedTeamId
      : (availableTeams[0]?.id ?? "");

  const userPicks = useMemo(
    () => picks.filter((pick) => pick.user?.id && currentManagerUserIds.includes(pick.user.id)),
    [currentManagerUserIds, picks],
  );

  const completedCriteria = useMemo(() => {
    const orderedUserPicks = [...userPicks].sort((left, right) => {
      const leftDate = left.pickedAt ? new Date(left.pickedAt).getTime() : 0;
      const rightDate = right.pickedAt ? new Date(right.pickedAt).getTime() : 0;
      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }
      if (left.round !== right.round) {
        return left.round - right.round;
      }
      return left.pickNumber - right.pickNumber;
    });

    const assignedSelections: Array<{ slotType: DraftSlot; team: Team }> = [];
    for (const pick of orderedUserPicks) {
      if (!pick.team) {
        continue;
      }

      const resolvedSlot = resolveTeamSlot(pick.team, assignedSelections);
      assignedSelections.push({
        slotType: resolvedSlot,
        team: pick.team,
      });
    }

    return draftRequirements.map((requirement) => {
      const selected = assignedSelections.filter((selection) => selection.slotType === requirement.slot).length;
      return { ...requirement, selected };
    });
  }, [userPicks]);

  const nextPicksUntilSelection = useMemo(() => {
    if (draftStatus !== "IN_PROGRESS" || draftIsComplete || userCount === 0) {
      return null;
    }

    for (let nextPickIndex = pickCount; nextPickIndex < totalPickCount; nextPickIndex += 1) {
      const picker = getPickerForPickIndex(nextPickIndex, sortedMembers);
      if (picker?.user.id === currentManagerUserId) {
        return nextPickIndex - pickCount;
      }
    }

    return null;
  }, [currentManagerUserId, draftIsComplete, draftStatus, pickCount, sortedMembers, totalPickCount, userCount]);

  const pickByRoundAndUserId = useMemo(() => {
    const map = new Map<string, DraftPick>();
    for (const pick of picks) {
      if (!pick.user?.id) {
        continue;
      }
      map.set(`${pick.round}-${pick.user.id}`, pick);
    }
    return map;
  }, [picks]);

  const roundCount = Math.max(DRAFT_ROUNDS, Math.ceil((pickCount + 1) / Math.max(userCount, 1)));

  async function handleDraftOrderUpdate(memberId: string, draftPosition: number) {
    if (!league || !isAdmin) return;

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
    await loadDraftData({ soft: true });
  }

  async function handleDraftStatusAction(action: "start" | "pause" | "resume") {
    if (!league || !isAdmin) return;

    setStatusSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/draft-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: league.id, action }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update draft status.");
      }

      setMessage(action === "start" ? "Draft started." : action === "pause" ? "Draft paused." : "Draft resumed.");
      await loadDraftData({ soft: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update draft status.");
    } finally {
      setStatusSubmitting(false);
    }
  }

  async function handleSubmitPick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!league || !effectiveSelectedTeamId || !activePickOwner) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/leagues/${league.id}/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: effectiveSelectedTeamId, userId: activePickOwner.user.id }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit pick.");
      }

      setMessage("Draft pick submitted.");
      await loadDraftData({ soft: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit pick.");
    } finally {
      setSubmitting(false);
    }
  }

  const canShowSubmitForm = draftStatus === "IN_PROGRESS" && !draftIsComplete && (isAdmin || isMyTurn);

  const clockLabel = draftIsComplete
    ? "Draft complete"
    : draftStatus === "NOT_STARTED"
      ? "Draft not started"
      : draftStatus === "PAUSED"
        ? "Draft paused"
        : deadlineAt
          ? formatTimeLeft(deadlineAt - now)
          : "--:--:--";
  const exactDeadlineLabel = deadlineAt
    ? new Date(deadlineAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    })
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">2026 draft board</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Draft clock and board</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              The draft starts only when an admin clicks Start Draft. Each pick then has a universal 48-hour clock.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Clock</p>
            <p className="mt-2 text-3xl font-semibold text-white">{clockLabel}</p>
            <p className="mt-1 text-sm text-slate-300">
              {activePickOwner ? `On the clock: ${activePickOwner.user.name ?? activePickOwner.user.email}` : "Waiting for admin action"}
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div>
      ) : null}

      {isAdmin ? (
        <section className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Admin indicator</p>
          <div className="mt-2 space-y-1 text-sm text-amber-100">
            <p>
              <span className="font-semibold">On the clock:</span>{" "}
              {activePickOwner ? (activePickOwner.user.name ?? activePickOwner.user.email) : "None"}
            </p>
            <p>
              <span className="font-semibold">Deadline:</span>{" "}
              {draftStatus === "IN_PROGRESS" && exactDeadlineLabel ? exactDeadlineLabel : "Not active"}
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Draft order</h3>
              <p className="mt-1 text-sm text-slate-400">Only admins can set the order before the draft starts.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadDraftData()}
                className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                Refresh
              </button>
              {isAdmin && draftStatus === "NOT_STARTED" ? (
                <button
                  type="button"
                  disabled={statusSubmitting || userCount === 0}
                  onClick={() => void handleDraftStatusAction("start")}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  Start Draft
                </button>
              ) : null}
              {isAdmin && draftStatus === "IN_PROGRESS" ? (
                <button
                  type="button"
                  disabled={statusSubmitting}
                  onClick={() => void handleDraftStatusAction("pause")}
                  className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Pause Draft
                </button>
              ) : null}
              {isAdmin && draftStatus === "PAUSED" ? (
                <button
                  type="button"
                  disabled={statusSubmitting}
                  onClick={() => void handleDraftStatusAction("resume")}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  Resume Draft
                </button>
              ) : null}
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {sortedMembers.map((entry) => {
              const memberName = getMemberDisplayName(entry.user);
              const position = draftOrder[entry.user.id] ?? entry.draftPosition ?? 1;
              return (
                <div
                  key={entry.user.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{memberName}</p>
                  </div>
                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-300">Pick</label>
                      <input
                        type="number"
                        min="1"
                        className="w-20 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={draftStatus !== "NOT_STARTED"}
                        value={position}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value || 1);
                          setDraftOrder((current) => ({ ...current, [entry.user.id]: nextValue }));
                        }}
                      />
                      <button
                        type="button"
                        disabled={draftStatus !== "NOT_STARTED"}
                        onClick={() => void handleDraftOrderUpdate(entry.user.id, position)}
                        className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-200">Pick {position}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <h3 className="text-xl font-semibold text-white">Submit a pick</h3>

          {draftStatus === "NOT_STARTED" ? (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Draft has not started yet. An admin must click Start Draft.
            </p>
          ) : null}

          {draftStatus === "PAUSED" ? (
            <p className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              Draft is currently paused.
            </p>
          ) : null}

          {draftIsComplete ? (
            <p className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
              Draft complete.
            </p>
          ) : null}

          {draftStatus === "IN_PROGRESS" && !draftIsComplete && !canShowSubmitForm ? (
            <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              {`${nextPicksUntilSelection ?? 0} picks until your next selection`}
            </p>
          ) : null}

          {canShowSubmitForm ? (
            <form onSubmit={handleSubmitPick} className="mt-5 space-y-4">
              <p className="text-sm text-slate-300">
                {isAdmin && activePickOwner
                  ? `Submitting pick for ${activePickOwner.user.name ?? activePickOwner.user.email}.`
                  : "You are on the clock."}
              </p>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Team</span>
                <select
                  value={effectiveSelectedTeamId}
                  onChange={(event) => setSelectedTeamId(event.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
                >
                  {availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.conference?.name ? `(${team.conference.name})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={submitting || !effectiveSelectedTeamId}
                className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {submitting ? "Submitting..." : "Submit pick"}
              </button>
            </form>
          ) : null}

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="text-lg font-semibold text-white">Your draft checklist</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {completedCriteria.map((criterion) => (
                <li
                  key={criterion.slot}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2"
                >
                  <span className={criterion.selected >= criterion.count ? "line-through text-slate-500" : "text-slate-200"}>
                    {criterion.label}
                  </span>
                  <span className="flex items-center gap-2">
                    {Array.from({ length: criterion.count }).map((_, index) => {
                      const checked = index < criterion.selected;
                      return (
                        <span
                          key={`${criterion.slot}-checkbox-${index + 1}`}
                          className={`inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-semibold ${
                            checked
                              ? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
                              : "border-white/20 bg-transparent text-slate-500"
                          }`}
                        >
                          {checked ? "✓" : ""}
                        </span>
                      );
                    })}
                  </span>
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
                  return (
                    <tr key={round}>
                      <td className="rounded-l-xl border border-white/10 bg-slate-950/70 px-4 py-3 font-medium text-white">
                        {round}
                      </td>
                      {sortedMembers.map((entry) => {
                        const pick = pickByRoundAndUserId.get(`${round}-${entry.user.id}`);
                        const isActiveCell =
                          activePickOwner?.user.id === entry.user.id &&
                          draftStatus === "IN_PROGRESS" &&
                          !draftIsComplete &&
                          Math.floor(pickCount / Math.max(userCount, 1)) + 1 === round;
                        return (
                          <td
                            key={`${round}-${entry.user.id}`}
                            className={`border px-4 py-3 ${isActiveCell ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-slate-950/70"}`}
                          >
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
