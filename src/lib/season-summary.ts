import { calculateTeamGamePoints } from "@/lib/scoring";
import { canonicalizeTeamName } from "@/lib/team-name";
import { POSTSEASON_PERIOD, SEASON_PERIODS, type SeasonPeriodValue } from "@/lib/season-periods";
import { calculatePostseasonGameBonusPoints, createPostseasonBonusTracker } from "@/lib/game-bonus";

export type SeasonHistoryManager = {
  key: string;
  season: number;
  finalRank: number;
  totalPoints: number;
  firstName: string | null;
  lastName: string | null;
  userId: string | null;
  email: string | null;
  displayName: string;
  teams: string[];
};

export type GameResult = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  completed: boolean;
  startDate?: string;
  seasonType?: string;
  notes?: string | null;
  conferenceGame?: boolean;
};

export type LineResult = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  lines: Array<{ spread: number | null }>;
};

export type WeekPayload = {
  games: GameResult[];
  lines: LineResult[];
};

export type SeasonPeriodPayload = {
  periodValue: SeasonPeriodValue;
  games: GameResult[];
  lines: LineResult[];
  cfpMatchupInfo?: Array<{
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
  }>;
};

export type WeekSummary = {
  managerKey: string;
  weeklyPoints: number;
  weeklyWins: number;
  weeklyLosses: number;
  weeklyPushes: number;
  weeklyAtsWins: number;
  weeklyAtsLosses: number;
  weeklyAtsPushes: number;
};

export type PeriodSummary = {
  manager: SeasonHistoryManager;
  weekly: WeekSummary;
  cumulativePoints: number;
  cumulativeWins: number;
  cumulativeLosses: number;
  cumulativePushes: number;
  cumulativeAtsWins: number;
  cumulativeAtsLosses: number;
  cumulativeAtsPushes: number;
};

export type TeamSummary = {
  wins: number;
  losses: number;
  pushes: number;
  atsWins: number;
  atsLosses: number;
  atsPushes: number;
  points: number;
};

export type SeasonSummaryResult = {
  periodSummaries: Record<string, PeriodSummary[]>;
  teamSummaries: Record<string, TeamSummary>;
};

function normalizeTeamName(teamName: string) {
  return canonicalizeTeamName(teamName);
}

export function getSeasonPeriodKey(period: SeasonPeriodValue) {
  return period === "postseason" ? "postseason" : String(period);
}

function createEmptyWeekSummary(managerKey: string): WeekSummary {
  return {
    managerKey,
    weeklyPoints: 0,
    weeklyWins: 0,
    weeklyLosses: 0,
    weeklyPushes: 0,
    weeklyAtsWins: 0,
    weeklyAtsLosses: 0,
    weeklyAtsPushes: 0,
  };
}

function createEmptyTeamSummary(): TeamSummary {
  return {
    wins: 0,
    losses: 0,
    pushes: 0,
    atsWins: 0,
    atsLosses: 0,
    atsPushes: 0,
    points: 0,
  };
}

export async function fetchSeasonPeriodPayloads(season: number): Promise<SeasonPeriodPayload[]> {
  const periodValues: SeasonPeriodValue[] = [
    ...SEASON_PERIODS.map((period) => period.value),
    POSTSEASON_PERIOD.value,
  ];

  const payloads = await Promise.all(
    periodValues.map(async (periodValue) => {
      const requestUrl = periodValue === "postseason"
        ? `/api/cfdb?season=${season}&type=postseasonData`
        : `/api/cfdb?season=${season}&week=${periodValue}&type=weekData`;
      const response = await fetch(requestUrl);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" && payload.error) ||
          (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string" && payload.message) ||
          `Unable to load ${periodValue === "postseason" ? "postseason" : `Week ${periodValue}`} data.`;
        throw new Error(errorMessage);
      }

      return {
        periodValue,
        games: Array.isArray(payload?.games) ? (payload.games as GameResult[]) : [],
        lines: Array.isArray(payload?.lines) ? (payload.lines as LineResult[]) : [],
        cfpMatchupInfo: Array.isArray(payload?.cfpMatchupInfo) ? payload.cfpMatchupInfo : [],
      };
    }),
  );

  return payloads;
}

export function buildSeasonSummaries(
  historyManagers: SeasonHistoryManager[],
  periodPayloads: SeasonPeriodPayload[],
): SeasonSummaryResult {
  const ownerByTeam = new Map<string, string>();
  for (const manager of historyManagers) {
    for (const team of manager.teams) {
      ownerByTeam.set(normalizeTeamName(team), manager.key);
    }
  }

  const managerTotals = new Map<string, {
    cumulativePoints: number;
    cumulativeWins: number;
    cumulativeLosses: number;
    cumulativePushes: number;
    cumulativeAtsWins: number;
    cumulativeAtsLosses: number;
    cumulativeAtsPushes: number;
  }>();
  const teamTotals: Record<string, TeamSummary> = {};
  const periodSummaries: Record<string, PeriodSummary[]> = {};

  const postseasonBonusTracker = createPostseasonBonusTracker();

  for (const periodPayload of periodPayloads) {
    const managerSummaryMap = new Map<string, WeekSummary>();
    for (const manager of historyManagers) {
      managerSummaryMap.set(manager.key, createEmptyWeekSummary(manager.key));
      if (!managerTotals.has(manager.key)) {
        managerTotals.set(manager.key, {
          cumulativePoints: 0,
          cumulativeWins: 0,
          cumulativeLosses: 0,
          cumulativePushes: 0,
          cumulativeAtsWins: 0,
          cumulativeAtsLosses: 0,
          cumulativeAtsPushes: 0,
        });
      }
    }

    const orderedGames = [...periodPayload.games].sort((left, right) => {
      const leftDate = left.startDate ? new Date(left.startDate).getTime() : 0;
      const rightDate = right.startDate ? new Date(right.startDate).getTime() : 0;
      return leftDate - rightDate;
    });

    for (const game of orderedGames) {
      if (!game.completed || game.homePoints == null || game.awayPoints == null) {
        continue;
      }

      const line = periodPayload.lines.find(
        (entry) =>
          normalizeTeamName(entry.homeTeam) === normalizeTeamName(game.homeTeam) &&
          normalizeTeamName(entry.awayTeam) === normalizeTeamName(game.awayTeam),
      );
      const primaryLine = line?.lines.find((entry) => entry.spread != null) ?? line?.lines[0];
      const spreadHome = primaryLine?.spread ?? null;
      const spreadAway = spreadHome != null ? -spreadHome : null;
      const hasSpread = spreadHome != null;
      const breakdown = calculateTeamGamePoints({
        homeScore: game.homePoints,
        awayScore: game.awayPoints,
        spreadHome,
        spreadAway,
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
        tracker: postseasonBonusTracker,
      });

      const homeTeam = normalizeTeamName(game.homeTeam);
      const awayTeam = normalizeTeamName(game.awayTeam);
      const homeOwnerKey = ownerByTeam.get(homeTeam);
      const awayOwnerKey = ownerByTeam.get(awayTeam);
      const isPush = game.homePoints === game.awayPoints;
      const homeWin = !isPush && game.homePoints > game.awayPoints;

      if (!teamTotals[homeTeam]) {
        teamTotals[homeTeam] = createEmptyTeamSummary();
      }
      if (!teamTotals[awayTeam]) {
        teamTotals[awayTeam] = createEmptyTeamSummary();
      }

      if (isPush) {
        teamTotals[homeTeam].pushes += 1;
        teamTotals[awayTeam].pushes += 1;
      } else if (homeWin) {
        teamTotals[homeTeam].wins += 1;
        teamTotals[awayTeam].losses += 1;
      } else {
        teamTotals[homeTeam].losses += 1;
        teamTotals[awayTeam].wins += 1;
      }

      teamTotals[homeTeam].points += breakdown.home.totalPoints + bonusPoints.home;
      teamTotals[awayTeam].points += breakdown.away.totalPoints + bonusPoints.away;

      if (hasSpread) {
        if (breakdown.home.coverPoints === 1) {
          teamTotals[homeTeam].atsWins += 1;
        } else if (breakdown.home.coverPoints === 0.5) {
          teamTotals[homeTeam].atsPushes += 1;
        } else {
          teamTotals[homeTeam].atsLosses += 1;
        }
      }

      if (hasSpread) {
        if (breakdown.away.coverPoints === 1) {
          teamTotals[awayTeam].atsWins += 1;
        } else if (breakdown.away.coverPoints === 0.5) {
          teamTotals[awayTeam].atsPushes += 1;
        } else {
          teamTotals[awayTeam].atsLosses += 1;
        }
      }

      if (homeOwnerKey) {
        const weekly = managerSummaryMap.get(homeOwnerKey);
        const cumulative = managerTotals.get(homeOwnerKey);
        if (weekly && cumulative) {
          weekly.weeklyPoints += breakdown.home.totalPoints + bonusPoints.home;
          if (isPush) {
            weekly.weeklyPushes += 1;
            cumulative.cumulativePushes += 1;
          } else if (homeWin) {
            weekly.weeklyWins += 1;
            cumulative.cumulativeWins += 1;
          } else {
            weekly.weeklyLosses += 1;
            cumulative.cumulativeLosses += 1;
          }

          cumulative.cumulativePoints += breakdown.home.totalPoints + bonusPoints.home;
          if (hasSpread) {
            if (breakdown.home.coverPoints === 1) {
              weekly.weeklyAtsWins += 1;
              cumulative.cumulativeAtsWins += 1;
            } else if (breakdown.home.coverPoints === 0.5) {
              weekly.weeklyAtsPushes += 1;
              cumulative.cumulativeAtsPushes += 1;
            } else {
              weekly.weeklyAtsLosses += 1;
              cumulative.cumulativeAtsLosses += 1;
            }
          }
        }
      }

      if (awayOwnerKey) {
        const weekly = managerSummaryMap.get(awayOwnerKey);
        const cumulative = managerTotals.get(awayOwnerKey);
        if (weekly && cumulative) {
          weekly.weeklyPoints += breakdown.away.totalPoints + bonusPoints.away;
          if (isPush) {
            weekly.weeklyPushes += 1;
            cumulative.cumulativePushes += 1;
          } else if (!homeWin) {
            weekly.weeklyWins += 1;
            cumulative.cumulativeWins += 1;
          } else {
            weekly.weeklyLosses += 1;
            cumulative.cumulativeLosses += 1;
          }

          cumulative.cumulativePoints += breakdown.away.totalPoints + bonusPoints.away;
          if (hasSpread) {
            if (breakdown.away.coverPoints === 1) {
              weekly.weeklyAtsWins += 1;
              cumulative.cumulativeAtsWins += 1;
            } else if (breakdown.away.coverPoints === 0.5) {
              weekly.weeklyAtsPushes += 1;
              cumulative.cumulativeAtsPushes += 1;
            } else {
              weekly.weeklyAtsLosses += 1;
              cumulative.cumulativeAtsLosses += 1;
            }
          }
        }
      }
    }

    periodSummaries[getSeasonPeriodKey(periodPayload.periodValue)] = historyManagers.map((manager) => {
      const weekly = managerSummaryMap.get(manager.key) ?? createEmptyWeekSummary(manager.key);
      const cumulative = managerTotals.get(manager.key);
      return {
        manager,
        weekly,
        cumulativePoints: cumulative?.cumulativePoints ?? 0,
        cumulativeWins: cumulative?.cumulativeWins ?? 0,
        cumulativeLosses: cumulative?.cumulativeLosses ?? 0,
        cumulativePushes: cumulative?.cumulativePushes ?? 0,
        cumulativeAtsWins: cumulative?.cumulativeAtsWins ?? 0,
        cumulativeAtsLosses: cumulative?.cumulativeAtsLosses ?? 0,
        cumulativeAtsPushes: cumulative?.cumulativeAtsPushes ?? 0,
      };
    });
  }

  return {
    periodSummaries,
    teamSummaries: teamTotals,
  };
}
