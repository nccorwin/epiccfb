'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCurrentSeasonLeagueContext } from "@/lib/active-league";
import { POSTSEASON_PERIOD, SEASON_PERIODS, type SeasonPeriodValue } from "@/lib/season-periods";
import {
  buildSeasonSummaries,
  fetchSeasonPeriodPayloads,
  getSeasonPeriodKey,
  type PeriodSummary,
  type SeasonHistoryManager,
} from "@/lib/season-summary";

function getPeriodOptions() {
  return [
    ...SEASON_PERIODS.map((period) => ({
      value: period.value,
      label: `${period.label} (${period.range})`,
    })),
    {
      value: POSTSEASON_PERIOD.value,
      label: `${POSTSEASON_PERIOD.label} (${POSTSEASON_PERIOD.range})`,
    },
  ];
}

function formatRecord(wins: number, losses: number, pushes: number) {
  return `${wins}-${losses}${pushes ? `-${pushes}` : ""}`;
}

export default function StandingsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<SeasonPeriodValue>("postseason");
  const [season, setSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [managers, setManagers] = useState<SeasonHistoryManager[]>([]);
  const [periodSummaries, setPeriodSummaries] = useState<Record<string, PeriodSummary[]>>({});

  const loadStandings = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const context = await fetchCurrentSeasonLeagueContext();
      const historyManagers = context.managers;
      setSeason(context.season);
      setManagers(historyManagers);
      const periodPayloads = await fetchSeasonPeriodPayloads(context.season);
      const summaries = buildSeasonSummaries(historyManagers, periodPayloads);
      setPeriodSummaries(summaries.periodSummaries);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load standings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStandings();
  }, [loadStandings]);

  const standings = useMemo(() => {
    const selectedPeriodKey = getSeasonPeriodKey(selectedPeriod);
    const selectedPeriodSummary = periodSummaries[selectedPeriodKey] ?? [];

    return managers
      .map((manager) => {
        const summary =
          selectedPeriodSummary.find((entry) => entry.manager.key === manager.key) ??
          null;

        return {
          manager,
          weekly: summary?.weekly ?? {
            managerKey: manager.key,
            weeklyPoints: 0,
            weeklyWins: 0,
            weeklyLosses: 0,
            weeklyPushes: 0,
            weeklyAtsWins: 0,
            weeklyAtsLosses: 0,
            weeklyAtsPushes: 0,
          },
          cumulativePoints: summary?.cumulativePoints ?? 0,
          cumulativeWins: summary?.cumulativeWins ?? 0,
          cumulativeLosses: summary?.cumulativeLosses ?? 0,
          cumulativePushes: summary?.cumulativePushes ?? 0,
          cumulativeAtsWins: summary?.cumulativeAtsWins ?? 0,
          cumulativeAtsLosses: summary?.cumulativeAtsLosses ?? 0,
          cumulativeAtsPushes: summary?.cumulativeAtsPushes ?? 0,
        };
      })
      .sort((left, right) => {
        if (right.cumulativePoints !== left.cumulativePoints) {
          return right.cumulativePoints - left.cumulativePoints;
        }
        return left.manager.finalRank - right.manager.finalRank;
      });
  }, [managers, periodSummaries, selectedPeriod]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Standings</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">League leaderboards{season ? ` - ${season}` : ""}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Review each manager&apos;s score for the selected period plus their cumulative record and points
              from Week 0 through that period.
            </p>
          </div>
          <label className="flex flex-col gap-2 text-sm text-slate-300">
            <span>Select period</span>
            <select
              value={selectedPeriod === "postseason" ? "postseason" : String(selectedPeriod)}
              onChange={(event) => {
                const nextValue = event.target.value === "postseason" ? "postseason" : Number(event.target.value);
                setSelectedPeriod(nextValue as SeasonPeriodValue);
              }}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
            >
              <optgroup label="Regular Season">
                {getPeriodOptions()
                  .filter((period) => typeof period.value === "number")
                  .map((period) => (
                    <option key={period.value} value={period.value}>
                      {period.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Postseason">
                <option value={POSTSEASON_PERIOD.value}>{`${POSTSEASON_PERIOD.label} (${POSTSEASON_PERIOD.range})`}</option>
              </optgroup>
            </select>
          </label>
        </div>
      </section>

      {message ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">
          Loading standings...
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl shadow-black/30">
          <div className="overflow-x-auto p-6">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm text-slate-200">
              <thead>
                <tr>
                  <th className="rounded-l-xl border border-white/10 bg-white/5 px-4 py-3 text-left">Manager</th>
                  <th className="border border-white/10 bg-white/5 px-4 py-3 text-left">Weekly W-L</th>
                  <th className="border border-white/10 bg-white/5 px-4 py-3 text-left">Weekly ATS</th>
                  <th className="border border-white/10 bg-white/5 px-4 py-3 text-left">Cumulative W-L</th>
                  <th className="border border-white/10 bg-white/5 px-4 py-3 text-left">Cumulative ATS</th>
                  <th className="border border-white/10 bg-white/5 px-4 py-3 text-left">Weekly Points</th>
                  <th className="rounded-r-xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                    Cumulative Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings.map((entry) => (
                  <tr key={entry.manager.key}>
                    <td className="rounded-l-xl border border-white/10 bg-slate-950/70 px-4 py-3">
                      <p className="font-semibold text-white">{entry.manager.displayName}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">
                        Draft Pos #{entry.manager.finalRank}
                      </p>
                    </td>
                    <td className="border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
                      {formatRecord(entry.weekly.weeklyWins, entry.weekly.weeklyLosses, entry.weekly.weeklyPushes)}
                    </td>
                    <td className="border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
                      {formatRecord(
                        entry.weekly.weeklyAtsWins,
                        entry.weekly.weeklyAtsLosses,
                        entry.weekly.weeklyAtsPushes,
                      )}
                    </td>
                    <td className="border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
                      {formatRecord(entry.cumulativeWins, entry.cumulativeLosses, entry.cumulativePushes)}
                    </td>
                    <td className="border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
                      {formatRecord(entry.cumulativeAtsWins, entry.cumulativeAtsLosses, entry.cumulativeAtsPushes)}
                    </td>
                    <td className="border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
                      {entry.weekly.weeklyPoints.toFixed(1)}
                    </td>
                    <td className="rounded-r-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
                      {entry.cumulativePoints.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
