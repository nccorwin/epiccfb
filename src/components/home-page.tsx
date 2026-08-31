'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCurrentSeasonLeagueContext } from "@/lib/active-league";
import { CURRENT_SEASON } from "@/lib/current-season";
import { canonicalizeTeamName } from "@/lib/team-name";
import { isLikelySameManager } from "@/lib/manager-name-match";
import {
  buildSeasonSummaries,
  fetchSeasonPeriodPayloads,
  getSeasonPeriodKey,
  type SeasonPeriodPayload,
  type PeriodSummary,
  type SeasonHistoryManager,
  type TeamSummary,
} from "@/lib/season-summary";
import { POSTSEASON_PERIOD, type SeasonPeriodValue } from "@/lib/season-periods";

function normalizeTeamName(name: string) {
  return canonicalizeTeamName(name);
}

function displayRecord(wins: number, losses: number, pushes: number) {
  return `${wins}-${losses}${pushes ? `-${pushes}` : ""}`;
}

function displayAtsRecord(wins: number, losses: number, ties: number) {
  return `${wins}-${losses}-${ties}`;
}

function getLatestCompletedPeriod(periodPayloads: SeasonPeriodPayload[]): SeasonPeriodValue | null {
  let latest: { period: SeasonPeriodValue; completedAt: number } | null = null;
  for (const payload of periodPayloads) {
    for (const game of payload.games) {
      if (!game.completed || game.homePoints == null || game.awayPoints == null) {
        continue;
      }

      const completedAt = game.startDate ? new Date(game.startDate).getTime() : 0;
      if (!latest || completedAt > latest.completedAt) {
        latest = { period: payload.periodValue, completedAt };
      }
    }
  }

  return latest?.period ?? null;
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
  const [season, setSeason] = useState(CURRENT_SEASON);
  const [seasonHistory, setSeasonHistory] = useState<SeasonHistoryManager[]>([]);
  const [periodSummaries, setPeriodSummaries] = useState<Record<string, PeriodSummary[]>>({});
  const [allTeamStats, setAllTeamStats] = useState<Record<string, TeamSummary>>({});
  const [latestCompletedPeriod, setLatestCompletedPeriod] = useState<SeasonPeriodValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const context = await fetchCurrentSeasonLeagueContext();
      const managers = context.managers;
      setSeason(context.season);
      setSeasonHistory(managers);
      const periodPayloads = await fetchSeasonPeriodPayloads(context.season);
      const summaries = buildSeasonSummaries(managers, periodPayloads);
      setPeriodSummaries(summaries.periodSummaries);
      setAllTeamStats(summaries.teamSummaries);
      setLatestCompletedPeriod(getLatestCompletedPeriod(periodPayloads));
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

  const postseasonSummaryByManager = useMemo(() => {
    const postseasonSummaryKey = getSeasonPeriodKey(POSTSEASON_PERIOD.value);
    const postseasonSummaries = periodSummaries[postseasonSummaryKey] ?? [];
    const map = new Map<string, PeriodSummary>();
    for (const summary of postseasonSummaries) {
      map.set(summary.manager.key, summary);
    }
    return map;
  }, [periodSummaries]);

  const standings = useMemo(() => {
    const latestCompletedPeriodKey = latestCompletedPeriod == null ? null : getSeasonPeriodKey(latestCompletedPeriod);
    const latestPeriodSummaries = latestCompletedPeriodKey ? periodSummaries[latestCompletedPeriodKey] ?? [] : [];
    const latestPeriodSummaryByManager = new Map<string, PeriodSummary>();
    for (const summary of latestPeriodSummaries) {
      latestPeriodSummaryByManager.set(summary.manager.key, summary);
    }

    return [...seasonHistory]
      .sort((left, right) => left.finalRank - right.finalRank)
      .map((manager) => ({
        manager,
        stats: postseasonSummaryByManager.get(manager.key) ?? null,
        latestWeeklyPoints: latestPeriodSummaryByManager.get(manager.key)?.weekly.weeklyPoints ?? 0,
      }))
      .sort((left, right) => {
        const pointDiff = (right.stats?.cumulativePoints ?? 0) - (left.stats?.cumulativePoints ?? 0);
        if (pointDiff !== 0) {
          return pointDiff;
        }
        return left.manager.finalRank - right.manager.finalRank;
      });
  }, [latestCompletedPeriod, periodSummaries, postseasonSummaryByManager, seasonHistory]);

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
  const latestPeriodStatsByManager = useMemo(() => {
    if (latestCompletedPeriod == null) {
      return new Map<string, PeriodSummary>();
    }
    const latestPeriodKey = getSeasonPeriodKey(latestCompletedPeriod);
    const summaries = periodSummaries[latestPeriodKey] ?? [];
    const map = new Map<string, PeriodSummary>();
    for (const summary of summaries) {
      map.set(summary.manager.key, summary);
    }
    return map;
  }, [latestCompletedPeriod, periodSummaries]);
  const myLatestPeriodStats = me ? latestPeriodStatsByManager.get(me.key) ?? null : null;
  const latestPeriodPointsLabel = latestCompletedPeriod == null
    ? "Latest week points"
    : latestCompletedPeriod === "postseason"
      ? "Postseason points"
      : `Week ${latestCompletedPeriod} points`;
  const myRank = useMemo(() => {
    if (!me) {
      return null;
    }
    const index = standings.findIndex((entry) => entry.manager.key === me.key);
    return index >= 0 ? index + 1 : null;
  }, [me, standings]);
  const fallbackCurrentUserName =
    [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ").trim() ||
    currentUser.name ||
    currentUser.email;
  const myName = me?.displayName ?? fallbackCurrentUserName;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="animate-pulse text-slate-400">Loading your {season} season overview...</p>
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
        <p className="text-xl font-semibold text-slate-200">No {season} league data available.</p>
        <p className="text-slate-400">Load managers and draft picks for the current season to continue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-emerald-500/20 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">{myName}</p>
        <div className="mt-4 flex flex-wrap items-end gap-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Season-to-date points</p>
            <p className="mt-1 text-6xl font-bold tabular-nums text-white">{myStats ? myStats.cumulativePoints.toFixed(1) : "--"}</p>
          </div>
          <div className="mb-1">
            <p className="text-xs uppercase tracking-widest text-slate-500">{latestPeriodPointsLabel}</p>
            <p className="text-3xl font-semibold tabular-nums text-emerald-300">
              +{myLatestPeriodStats ? myLatestPeriodStats.weekly.weeklyPoints.toFixed(1) : "0.0"}
            </p>
          </div>
          <div className="mb-1">
            <p className="text-xs uppercase tracking-widest text-slate-500">Current rank</p>
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
              Season ATS (W-L-T):{" "}
              <strong className="text-slate-200">
                {displayAtsRecord(myStats.cumulativeAtsWins, myStats.cumulativeAtsLosses, myStats.cumulativeAtsPushes)}
              </strong>
            </span>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <h2 className="mb-6 text-lg font-semibold text-white">{season} standings to date</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-widest text-slate-500">
                <th className="pb-3 pr-3">#</th>
                <th className="pb-3 pr-4">Manager</th>
                <th className="pb-3 pr-4 text-right">Record</th>
                <th className="pb-3 pr-4 text-right">ATS</th>
                <th className="pb-3 pr-4 text-right">{latestCompletedPeriod === "postseason" ? "Postseason pts" : "Latest wk pts"}</th>
                <th className="pb-3 text-right">Season pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map(({ manager, stats, latestWeeklyPoints }, index) => {
                const isSelf = me?.key === manager.key || manager.userId === currentUser.id;
                return (
                  <tr
                    key={manager.key}
                    className={`border-b border-white/5 transition ${isSelf ? "bg-emerald-500/5" : "hover:bg-white/3"}`}
                  >
                    <td className={`py-3 pr-3 font-mono text-xs ${isSelf ? "text-emerald-400" : "text-slate-500"}`}>{index + 1}</td>
                    <td className={`py-3 pr-4 font-medium ${isSelf ? "text-emerald-200" : "text-slate-100"}`}>
                      {manager.displayName}
                      {isSelf && <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">you</span>}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-300">
                      {stats ? displayRecord(stats.cumulativeWins, stats.cumulativeLosses, stats.cumulativePushes) : "--"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-300">
                      {stats ? displayAtsRecord(stats.cumulativeAtsWins, stats.cumulativeAtsLosses, stats.cumulativeAtsPushes) : "--"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-emerald-300">
                      +{latestWeeklyPoints.toFixed(1)}
                    </td>
                    <td className="py-3 text-right tabular-nums font-bold text-white">{stats ? stats.cumulativePoints.toFixed(1) : "0.0"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <h2 className="mb-6 text-lg font-semibold text-white">My {season} roster</h2>
        {!me || !me.teams.length ? (
          <p className="text-slate-400">No roster data found for your account in the current season draft.</p>
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
                        {stats ? displayAtsRecord(stats.atsWins, stats.atsLosses, stats.atsPushes) : "--"}
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
