'use client';

import { useEffect, useMemo, useState } from "react";
import { fetchCurrentSeasonLeagueContext } from "@/lib/active-league";
import { CURRENT_SEASON } from "@/lib/current-season";
import { calculateTeamGamePoints } from "@/lib/scoring";
import { calculateGameBonusPoints, calculatePostseasonGameBonusPoints, createPostseasonBonusTracker } from "@/lib/game-bonus";
import { canonicalizeTeamName } from "@/lib/team-name";
import { getCurrentSeasonPeriod, getSeasonPeriodLabel, POSTSEASON_PERIOD, SEASON_PERIODS, type SeasonPeriodValue } from "@/lib/season-periods";
import type { SeasonHistoryManager } from "@/lib/season-summary";

type GameResult = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  completed: boolean;
  startDate: string;
  seasonType: string;
  homeClassification: string | null;
  awayClassification: string | null;
  notes: string | null;
};

type LineResult = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  lines: Array<{ spread: number | null; provider: string }>;
};

type CfpMatchupInfo = {
  gameId: number | null;
  round: string;
  roundName: string;
  roundOrder: number;
  bowlName: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homePoints: number | null;
  awayPoints: number | null;
  completed: boolean;
  startDate: string | null;
  line: LineResult | null;
};

type PostseasonDisplayItem =
  | { kind: "game"; game: GameResult }
  | { kind: "cfp"; matchup: CfpMatchupInfo };

type GamePointsBreakdown = ReturnType<typeof calculateTeamGamePoints>;

type PostseasonScoringResult = {
  breakdown: GamePointsBreakdown;
  bonusPoints: {
    home: number;
    away: number;
  };
};

function normalizeTeamName(teamName: string) {
  return canonicalizeTeamName(teamName);
}

function getPostseasonItemKey(item: PostseasonDisplayItem) {
  return item.kind === "game"
    ? `game-${item.game.id}`
    : `cfp-${item.matchup.gameId ?? item.matchup.startDate ?? item.matchup.roundName}`;
}

function isFbsFcsGame(game: GameResult): boolean {
  return (
    game.homeClassification === "fbs" ||
    game.homeClassification === "fcs" ||
    game.awayClassification === "fbs" ||
    game.awayClassification === "fcs"
  );
}

function GameCard({
  game,
  line,
  homeOwner,
  awayOwner,
  roundBadge,
  bonusPoints,
}: {
  game: GameResult;
  line: LineResult | undefined;
  homeOwner: string;
  awayOwner: string;
  roundBadge?: string;
  bonusPoints?: {
    home: number;
    away: number;
  };
}) {
  const primaryLine = line?.lines.find((entry) => entry.spread != null) ?? line?.lines[0];
  const spreadHome = primaryLine?.spread ?? null;
  const spreadAway = spreadHome != null ? -spreadHome : null;
  const breakdown = calculateTeamGamePoints({
    homeScore: game.homePoints ?? 0,
    awayScore: game.awayPoints ?? 0,
    spreadHome,
    spreadAway,
    completed: game.completed,
  });
  const computedBonusPoints = bonusPoints ?? calculateGameBonusPoints({
    game,
    spreadHome,
    spreadAway,
  });

  const homeWon = game.completed && game.homePoints != null && game.awayPoints != null && game.homePoints > game.awayPoints;
  const awayWon = game.completed && game.homePoints != null && game.awayPoints != null && game.awayPoints > game.homePoints;
  const gameLabel = game.notes ?? (game.completed ? "Final" : "Scheduled");

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
        <span>{new Date(game.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        <div className="flex items-center gap-2">
          {roundBadge ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">
              {roundBadge}
            </span>
          ) : null}
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em]">
            {gameLabel}
          </span>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {/* Home team */}
        <div className={`rounded-2xl border p-4 ${homeWon ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white">{game.homeTeam}</p>
              <p className="mt-1 text-sm text-slate-400">
                {homeOwner !== "Unassigned" ? (
                  <span className="text-emerald-400">{homeOwner}</span>
                ) : (
                  <span className="text-slate-500">Unassigned</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-semibold ${homeWon ? "text-emerald-300" : "text-white"}`}>
                {game.completed ? game.homePoints : "—"}
              </p>
              {game.completed ? (
                <p className="text-sm text-slate-400">
                  +{(breakdown.home.totalPoints + computedBonusPoints.home).toFixed(1)} pts
                  {spreadHome != null ? (
                    <span className="ml-2 text-slate-500">({spreadHome > 0 ? "+" : ""}{spreadHome})</span>
                  ) : null}
                </p>
              ) : spreadHome != null ? (
                <p className="text-sm text-slate-500">{spreadHome > 0 ? "+" : ""}{spreadHome}</p>
              ) : null}
            </div>
          </div>
        </div>
        {/* Away team */}
        <div className={`rounded-2xl border p-4 ${awayWon ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-white">{game.awayTeam}</p>
              <p className="mt-1 text-sm text-slate-400">
                {awayOwner !== "Unassigned" ? (
                  <span className="text-emerald-400">{awayOwner}</span>
                ) : (
                  <span className="text-slate-500">Unassigned</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-semibold ${awayWon ? "text-emerald-300" : "text-white"}`}>
                {game.completed ? game.awayPoints : "—"}
              </p>
              {game.completed ? (
                <p className="text-sm text-slate-400">
                  +{(breakdown.away.totalPoints + computedBonusPoints.away).toFixed(1)} pts
                  {spreadAway != null ? (
                    <span className="ml-2 text-slate-500">({spreadAway > 0 ? "+" : ""}{spreadAway})</span>
                  ) : null}
                </p>
              ) : spreadAway != null ? (
                <p className="text-sm text-slate-500">{spreadAway > 0 ? "+" : ""}{spreadAway}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScoreboardPage() {
  const [season, setSeason] = useState<number | null>(null);
  const [managers, setManagers] = useState<SeasonHistoryManager[]>([]);
  const [games, setGames] = useState<GameResult[]>([]);
  const [lines, setLines] = useState<LineResult[]>([]);
  const [cfpMatchupInfo, setCfpMatchupInfo] = useState<CfpMatchupInfo[]>([]);
  const [cfpGameIds, setCfpGameIds] = useState<number[]>([]);
  const [priorFcsFirstRoundTeams, setPriorFcsFirstRoundTeams] = useState<string[]>([]);
  const [selectedView, setSelectedView] = useState<SeasonPeriodValue>(() => getCurrentSeasonPeriod(CURRENT_SEASON));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const isPostseason = selectedView === "postseason";

  useEffect(() => {
    void loadScoreboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedView]);

  async function loadScoreboard() {
    setLoading(true);
    setMessage(null);

    try {
      const context = await fetchCurrentSeasonLeagueContext();
      const targetSeason = context.season;
      setSeason(targetSeason);
      setManagers(context.managers);

      if (isPostseason) {
        const postRes = await fetch(`/api/cfdb?season=${targetSeason}&type=postseasonData`);
        if (!postRes.ok) throw new Error("Unable to load postseason data.");
        const postPayload = await postRes.json();
        setGames(Array.isArray(postPayload?.games) ? postPayload.games : []);
        setLines(Array.isArray(postPayload?.lines) ? postPayload.lines : []);
        setCfpMatchupInfo(Array.isArray(postPayload?.cfpMatchupInfo) ? postPayload.cfpMatchupInfo : []);
        setCfpGameIds(Array.isArray(postPayload?.cfpGameIds) ? postPayload.cfpGameIds : []);
        setPriorFcsFirstRoundTeams(Array.isArray(postPayload?.priorFcsFirstRoundTeams) ? postPayload.priorFcsFirstRoundTeams : []);
      } else {
        const weekNum = Number(selectedView);
        const weekRes = await fetch(`/api/cfdb?season=${targetSeason}&week=${weekNum}&type=weekData`);
        if (!weekRes.ok) throw new Error("Unable to load week data.");
        const weekPayload = await weekRes.json();
        setGames(Array.isArray(weekPayload?.games) ? weekPayload.games : []);
        setLines(Array.isArray(weekPayload?.lines) ? weekPayload.lines : []);
        setCfpMatchupInfo([]);
        setCfpGameIds([]);
        setPriorFcsFirstRoundTeams(Array.isArray(weekPayload?.priorFcsFirstRoundTeams) ? weekPayload.priorFcsFirstRoundTeams : []);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load scoreboard data.");
    } finally {
      setLoading(false);
    }
  }

  const ownershipMap = useMemo(() => {
    const map = new Map<string, string>();
    managers.forEach((mgr) => {
      mgr.teams.forEach((team) => {
        map.set(normalizeTeamName(team), mgr.displayName);
      });
    });
    return map;
  }, [managers]);

  const postseasonItems = useMemo<PostseasonDisplayItem[]>(() => {
    const excludedCfpGameIds = new Set(cfpGameIds);
    const regularGames = games
      .filter((game) => !excludedCfpGameIds.has(game.id))
      .filter(isFbsFcsGame)
      .map((game) => ({ kind: "game" as const, game }));
    const cfpGames = cfpMatchupInfo.map((matchup) => ({ kind: "cfp" as const, matchup }));

    return [...regularGames, ...cfpGames].sort((left, right) => {
      const leftDate = left.kind === "game"
        ? new Date(left.game.startDate).getTime()
        : new Date(left.matchup.startDate ?? 0).getTime();
      const rightDate = right.kind === "game"
        ? new Date(right.game.startDate).getTime()
        : new Date(right.matchup.startDate ?? 0).getTime();

      if (leftDate !== rightDate) {
        return leftDate - rightDate;
      }

      const leftLabel = left.kind === "game"
        ? `${left.game.homeTeam} ${left.game.awayTeam}`
        : `${left.matchup.homeTeam ?? ""} ${left.matchup.awayTeam ?? ""}`;
      const rightLabel = right.kind === "game"
        ? `${right.game.homeTeam} ${right.game.awayTeam}`
        : `${right.matchup.homeTeam ?? ""} ${right.matchup.awayTeam ?? ""}`;

      return leftLabel.localeCompare(rightLabel);
    });
  }, [games, cfpGameIds, cfpMatchupInfo]);

  const filteredGames = useMemo(() => {
    if (isPostseason) {
      return [];
    }
    return games.filter(isFbsFcsGame);
  }, [games, isPostseason]);

  const sortedGames = useMemo(() => {
    return [...filteredGames].sort((a, b) => {
      const timeDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (timeDiff !== 0) return timeDiff;
      return `${a.homeTeam} ${a.awayTeam}`.localeCompare(`${b.homeTeam} ${b.awayTeam}`);
    });
  }, [filteredGames]);

  const lineByGame = useMemo(() => {
    const map = new Map<string, LineResult>();
    lines.forEach((l) => {
      map.set(`${normalizeTeamName(l.homeTeam)}|${normalizeTeamName(l.awayTeam)}`, l);
    });
    return map;
  }, [lines]);

  const postseasonScoringByKey = useMemo(() => {
    const scored = new Map<string, PostseasonScoringResult>();
    const tracker = createPostseasonBonusTracker();
    for (const team of priorFcsFirstRoundTeams) {
      tracker.fcsAppearanceTeams.add(team);
    }

    for (const item of postseasonItems) {
      const key = getPostseasonItemKey(item);
      const game = item.kind === "game"
        ? item.game
        : {
          homeTeam: item.matchup.homeTeam ?? "",
          awayTeam: item.matchup.awayTeam ?? "",
          homePoints: item.matchup.homePoints,
          awayPoints: item.matchup.awayPoints,
          notes: item.matchup.roundName ? `College Football Playoff ${item.matchup.roundName}` : null,
        };

      if (game.homePoints == null || game.awayPoints == null) {
        continue;
      }

      if ("completed" in game && !game.completed) {
        continue;
      }

      const line = item.kind === "game"
        ? getLineForGame(game)
        : item.matchup.line;
      const primaryLine = line?.lines.find((entry) => entry.spread != null) ?? line?.lines[0];
      const spreadHome = primaryLine?.spread ?? null;
      const spreadAway = spreadHome != null ? -spreadHome : null;
      const breakdown = calculateTeamGamePoints({
        homeScore: game.homePoints,
        awayScore: game.awayPoints,
        spreadHome,
        spreadAway,
        completed: "completed" in game ? game.completed : true,
      });
      const bonusPoints = calculatePostseasonGameBonusPoints({
        game: {
          homeTeam: normalizeTeamName(game.homeTeam),
          awayTeam: normalizeTeamName(game.awayTeam),
          homePoints: game.homePoints,
          awayPoints: game.awayPoints,
          notes: game.notes,
        },
        spreadHome,
        spreadAway,
        tracker,
      });

      scored.set(key, { breakdown, bonusPoints });
    }

    return scored;
  }, [getLineForGame, postseasonItems, priorFcsFirstRoundTeams]);

  const regularScoringById = useMemo(() => {
    const scored = new Map<number, PostseasonScoringResult>();
    const tracker = createPostseasonBonusTracker();
    for (const team of priorFcsFirstRoundTeams) {
      tracker.fcsAppearanceTeams.add(team);
    }

    for (const game of sortedGames) {
      if (!game.completed || game.homePoints == null || game.awayPoints == null) {
        continue;
      }

      const line = getLineForGame(game);
      const primaryLine = line?.lines.find((entry) => entry.spread != null) ?? line?.lines[0];
      const spreadHome = primaryLine?.spread ?? null;
      const spreadAway = spreadHome != null ? -spreadHome : null;
      const breakdown = calculateTeamGamePoints({
        homeScore: game.homePoints,
        awayScore: game.awayPoints,
        spreadHome,
        spreadAway,
        completed: game.completed,
      });
      const notes = game.notes ?? null;
      const bonusPoints = notes && (notes.includes("College Football Playoff") || notes.includes("FCS Championship"))
        ? calculatePostseasonGameBonusPoints({
          game: {
            homeTeam: normalizeTeamName(game.homeTeam),
            awayTeam: normalizeTeamName(game.awayTeam),
            homePoints: game.homePoints,
            awayPoints: game.awayPoints,
            notes,
          },
          spreadHome,
          spreadAway,
          tracker,
        })
        : calculateGameBonusPoints({
          game,
          spreadHome,
          spreadAway,
        });

      scored.set(game.id, { breakdown, bonusPoints });
    }

    return scored;
  }, [getLineForGame, sortedGames, priorFcsFirstRoundTeams]);

  function getLineForGame(game: { homeTeam: string; awayTeam: string }) {
    return lineByGame.get(`${normalizeTeamName(game.homeTeam)}|${normalizeTeamName(game.awayTeam)}`);
  }

  function formatSpread(spread: number | null) {
    if (spread == null) {
      return null;
    }
    return `${spread > 0 ? "+" : ""}${spread}`;
  }

  const viewLabel = selectedView === "postseason"
    ? "Postseason (Bowls / FCS Playoffs / CFP)"
    : getSeasonPeriodLabel(selectedView);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Weekly scoreboard</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Week-by-week results{season ? ` - ${season}` : ""}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
              Review completed, in-progress, and upcoming games. Only FBS and FCS matchups are shown. Select a week or postseason view below.
            </p>
          </div>
          <label className="flex flex-col gap-2 text-sm text-slate-300 lg:min-w-[260px]">
            <span>Select period</span>
            <select
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value as SeasonPeriodValue)}
              className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
            >
              <optgroup label="Regular Season">
                {SEASON_PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>{`${period.label} (${period.range})`}</option>
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
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{message}</div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">
          Loading {viewLabel}…
        </div>
      ) : isPostseason ? (
        <div className="space-y-4">
          {postseasonItems.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">
              No postseason games found for {viewLabel}.
            </div>
          ) : (
            postseasonItems.map((item) => {
              if (item.kind === "cfp") {
                const matchup = item.matchup;
                const matchupLabel = matchup.roundName || "College Football Playoff";
                const scoring = postseasonScoringByKey.get(getPostseasonItemKey(item));
                const primaryLine = matchup.line?.lines.find((entry) => entry.spread != null) ?? matchup.line?.lines[0];
                const spreadHome = primaryLine?.spread ?? null;
                const spreadAway = spreadHome != null ? -spreadHome : null;
                return (
                  <div key={`cfp-${matchup.gameId ?? matchup.startDate ?? matchup.roundName}`} className="rounded-3xl border border-amber-400/20 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
                      <span>{matchup.startDate ? new Date(matchup.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD"}</span>
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">
                        {matchupLabel}
                      </span>
                    </div>
                    {matchup.bowlName ? (
                      <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-500">{matchup.bowlName}</p>
                    ) : null}
                    <div className="mt-5 space-y-3">
                      {[
                        { team: matchup.homeTeam, pts: matchup.homePoints, won: matchup.completed && matchup.homePoints != null && matchup.awayPoints != null && matchup.homePoints > matchup.awayPoints },
                        { team: matchup.awayTeam, pts: matchup.awayPoints, won: matchup.completed && matchup.homePoints != null && matchup.awayPoints != null && matchup.awayPoints > matchup.homePoints },
                      ].map(({ team, pts, won }) => (
                        (() => {
                          const teamSpread = team === matchup.homeTeam ? spreadHome : spreadAway;
                          const spreadText = formatSpread(teamSpread);
                          return (
                        <div key={`${matchup.gameId ?? matchup.roundName}-${team ?? "tbd"}`} className={`rounded-2xl border p-4 ${won ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{team ?? "TBD"}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {team ? (ownershipMap.get(normalizeTeamName(team)) ? <span className="text-emerald-400">{ownershipMap.get(normalizeTeamName(team))}</span> : "Unassigned") : null}
                              </p>
                            </div>
                            <p className={`text-2xl font-semibold ${won ? "text-emerald-300" : "text-white"}`}>
                              {matchup.completed ? pts : "—"}
                            </p>
                          </div>
                          {matchup.completed ? (
                            <p className="mt-2 text-sm text-slate-400">
                              +{(team === matchup.homeTeam
                                ? (scoring?.breakdown.home.totalPoints ?? 0) + (scoring?.bonusPoints.home ?? 0)
                                : (scoring?.breakdown.away.totalPoints ?? 0) + (scoring?.bonusPoints.away ?? 0)
                              ).toFixed(1)} pts
                              {spreadText ? (
                                <span className="ml-2 text-slate-500">
                                  ({spreadText})
                                </span>
                              ) : null}
                            </p>
                          ) : spreadText ? (
                            <p className="mt-2 text-sm text-slate-500">
                              {spreadText}
                            </p>
                          ) : null}
                        </div>
                          );
                        })()
                      ))}
                    </div>
                  </div>
                );
              }

              const game = item.game;
              return (
                <GameCard
                  key={game.id}
                  game={game}
                  line={getLineForGame(game)}
                  homeOwner={ownershipMap.get(normalizeTeamName(game.homeTeam)) ?? "Unassigned"}
                  awayOwner={ownershipMap.get(normalizeTeamName(game.awayTeam)) ?? "Unassigned"}
                  roundBadge={game.notes ?? "Postseason"}
                  bonusPoints={postseasonScoringByKey.get(getPostseasonItemKey(item))?.bonusPoints}
                />
              );
            })
          )}
        </div>
      ) : (
        /* ── Regular season or Bowls: flat sorted list ── */
        <div className="space-y-4">
          {sortedGames.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-10 text-center text-slate-400">
              No FBS/FCS games found for {viewLabel}.
            </div>
          ) : (
            (() => {
              const rows: GameResult[][] = [];
              for (let i = 0; i < sortedGames.length; i += 2) {
                rows.push(sortedGames.slice(i, i + 2));
              }
              return rows.map((row, rowIdx) => (
                <div key={`row-${rowIdx}`} className="grid gap-4 xl:grid-cols-2">
                  {row.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      line={getLineForGame(game)}
                      homeOwner={ownershipMap.get(normalizeTeamName(game.homeTeam)) ?? "Unassigned"}
                      awayOwner={ownershipMap.get(normalizeTeamName(game.awayTeam)) ?? "Unassigned"}
                      bonusPoints={regularScoringById.get(game.id)?.bonusPoints}
                    />
                  ))}
                </div>
              ));
            })()
          )}
        </div>
      )}
    </div>
  );
}