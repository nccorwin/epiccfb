'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { canonicalizeTeamName } from "@/lib/team-name";
import { isLikelySameManager } from "@/lib/manager-name-match";
import {
  buildSeasonSummaries,
  fetchSeasonPeriodPayloads,
  getSeasonPeriodKey,
  type PeriodSummary,
  type SeasonHistoryManager,
  type TeamSummary,
} from "@/lib/season-summary";
import { POSTSEASON_PERIOD } from "@/lib/season-periods";

type LeagueHistoryResponse = {
  season: number;
  managers: SeasonHistoryManager[];
};

const TARGET_SEASON = 2025;

function normalizeTeamName(name: string) {
  return canonicalizeTeamName(name);
}

function displayRecord(wins: number, losses: number, pushes: number) {
  return `${wins}-${losses}${pushes ? `-${pushes}` : ""}`;
}

export default function HomePage({
  currentUser,
}: {
  currentUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
  };
}) {
  const [seasonHistory, setSeasonHistory] = useState<SeasonHistoryManager[]>([]);
  const [periodSummaries, setPeriodSummaries] = useState<Record<string, PeriodSummary[]>>({});
  const [allTeamStats, setAllTeamStats] = useState<Record<string, TeamSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const historyResponse = await fetch(`/api/league-history?season=${TARGET_SEASON}`);
      if (!historyResponse.ok) {
        throw new Error("Unable to load league history.");
      }

      const historyPayload: LeagueHistoryResponse = await historyResponse.json();
      const managers = Array.isArray(historyPayload.managers) ? historyPayload.managers : [];
      setSeasonHistory(managers);
      const periodPayloads = await fetchSeasonPeriodPayloads(TARGET_SEASON);
      const summaries = buildSeasonSummaries(managers, periodPayloads);
      setPeriodSummaries(summaries.periodSummaries);
      setAllTeamStats(summaries.teamSummaries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const standings = useMemo(() => {
    return [...seasonHistory].sort((left, right) => left.finalRank - right.finalRank);
  }, [seasonHistory]);

  const postseasonSummaryByManager = useMemo(() => {
    const postseasonSummaryKey = getSeasonPeriodKey(POSTSEASON_PERIOD.value);
    const postseasonSummaries = periodSummaries[postseasonSummaryKey] ?? [];
    const map = new Map<string, PeriodSummary>();
    for (const summary of postseasonSummaries) {
      map.set(summary.manager.key, summary);
    }
    return map;
  }, [periodSummaries]);

  const me = useMemo(() => {
    const exactByUserId = seasonHistory.find((manager) => manager.userId === currentUser.id);
    if (exactByUserId) {
      return exactByUserId;
    }

    const exactByEmail = seasonHistory.find((manager) => manager.email?.toLowerCase() === currentUser.email.toLowerCase());
    if (exactByEmail) {
      return exactByEmail;
    }

    return seasonHistory.find((manager) =>
      isLikelySameManager(
        {
          userId: currentUser.id,
          email: currentUser.email,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          displayName: currentUser.name,
        },
        manager,
      ),
    ) ?? null;
  }, [currentUser.email, currentUser.firstName, currentUser.id, currentUser.lastName, currentUser.name, seasonHistory]);

  const myStats = me ? postseasonSummaryByManager.get(me.key) ?? null : null;
  const myRank = me?.finalRank ?? null;
  const fallbackCurrentUserName =
    [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ").trim() ||
    currentUser.name ||
    currentUser.email;
  const myName = me?.displayName ?? fallbackCurrentUserName;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="animate-pulse text-slate-400">Loading your 2025 season recap...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-rose-400">{error}</p>
      </div>
    );
  }

  if (!seasonHistory.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-xl font-semibold text-slate-200">No 2025 history data available.</p>
        <p className="text-slate-400">Run the league history CSV import to load season recap records.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-emerald-500/20 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">{myName}</p>
        <div className="mt-4 flex flex-wrap items-end gap-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Final points (CSV)</p>
            <p className="mt-1 text-6xl font-bold tabular-nums text-white">{me ? me.totalPoints.toFixed(1) : "--"}</p>
          </div>
          <div className="mb-1">
            <p className="text-xs uppercase tracking-widest text-slate-500">Postseason points</p>
            <p className="text-3xl font-semibold tabular-nums text-emerald-300">
              +{myStats ? myStats.weekly.weeklyPoints.toFixed(1) : "0.0"}
            </p>
          </div>
          <div className="mb-1">
            <p className="text-xs uppercase tracking-widest text-slate-500">Final rank</p>
            <p className="text-3xl font-semibold tabular-nums text-slate-200">
              #{myRank ?? "--"} <span className="text-lg text-slate-500">of {seasonHistory.length}</span>
            </p>
          </div>
        </div>
        {myStats && (
          <div className="mt-5 flex flex-wrap gap-6 text-sm text-slate-400">
            <span>
              Season record:{" "}
              <strong className="text-slate-200">
                {displayRecord(myStats.cumulativeWins, myStats.cumulativeLosses, myStats.cumulativePushes)}
              </strong>
            </span>
            <span>
              Season ATS:{" "}
              <strong className="text-slate-200">
                {displayRecord(myStats.cumulativeAtsWins, myStats.cumulativeAtsLosses, myStats.cumulativeAtsPushes)}
              </strong>
            </span>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <h2 className="mb-6 text-lg font-semibold text-white">2025 final standings</h2>
        <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Final standings now use the same postseason cumulative source as the Standings tab.
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-widest text-slate-500">
                <th className="pb-3 pr-3">#</th>
                <th className="pb-3 pr-4">Manager</th>
                <th className="pb-3 pr-4 text-right">Record</th>
                <th className="pb-3 pr-4 text-right">ATS</th>
                <th className="pb-3 pr-4 text-right">Wk 17 pts</th>
                <th className="pb-3 text-right">Final pts (CSV)</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((manager) => {
                const isSelf = me?.key === manager.key || manager.userId === currentUser.id;
                const stats = postseasonSummaryByManager.get(manager.key) ?? null;
                return (
                  <tr
                    key={manager.key}
                    className={`border-b border-white/5 transition ${isSelf ? "bg-emerald-500/5" : "hover:bg-white/3"}`}
                  >
                    <td className={`py-3 pr-3 font-mono text-xs ${isSelf ? "text-emerald-400" : "text-slate-500"}`}>{manager.finalRank}</td>
                    <td className={`py-3 pr-4 font-medium ${isSelf ? "text-emerald-200" : "text-slate-100"}`}>
                      {manager.displayName}
                      {isSelf && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">you</span>}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-300">
                      {stats ? displayRecord(stats.cumulativeWins, stats.cumulativeLosses, stats.cumulativePushes) : "--"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-300">
                      {stats ? displayRecord(stats.cumulativeAtsWins, stats.cumulativeAtsLosses, stats.cumulativeAtsPushes) : "--"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-emerald-300">
                      +{stats ? stats.weekly.weeklyPoints.toFixed(1) : "0.0"}
                    </td>
                    <td className="py-3 text-right tabular-nums font-bold text-white">{manager.totalPoints.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <h2 className="mb-6 text-lg font-semibold text-white">My 2025 roster</h2>
        {!me || !me.teams.length ? (
          <p className="text-slate-400">No roster data found for your account in the 2025 history file.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {me.teams.map((teamName) => {
              const key = normalizeTeamName(teamName);
              const stats = allTeamStats[key];
              return (
                <div
                  key={teamName}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-800/60 px-5 py-4"
                >
                  <p className="font-semibold text-white">{teamName}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span>
                      Record:{" "}
                      <strong className="text-slate-200">
                        {stats ? displayRecord(stats.wins, stats.losses, stats.pushes) : "--"}
                      </strong>
                    </span>
                    <span>
                      ATS:{" "}
                      <strong className="text-slate-200">
                        {stats ? displayRecord(stats.atsWins, stats.atsLosses, stats.atsPushes) : "--"}
                      </strong>
                    </span>
                    <span>
                      Pts: <strong className="text-emerald-300">{stats ? stats.points.toFixed(1) : "0.0"}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
