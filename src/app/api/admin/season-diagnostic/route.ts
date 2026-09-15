import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { buildSeasonManagers, selectActiveLeague } from "@/lib/active-league";
import { getPostseasonData, getWeekData } from "@/lib/cfdb";
import { CURRENT_SEASON } from "@/lib/current-season";
import { prisma } from "@/lib/prisma";
import {
  buildSeasonSummaries,
  getSeasonPeriodKey,
  type PeriodSummary,
  type SeasonPeriodPayload,
} from "@/lib/season-summary";
import { canonicalizeTeamName } from "@/lib/team-name";
import { POSTSEASON_PERIOD, SEASON_PERIODS } from "@/lib/season-periods";

function toRecord(summary: PeriodSummary | null) {
  if (!summary) {
    return {
      points: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      atsWins: 0,
      atsLosses: 0,
      atsPushes: 0,
    };
  }

  return {
    points: summary.cumulativePoints,
    wins: summary.cumulativeWins,
    losses: summary.cumulativeLosses,
    pushes: summary.cumulativePushes,
    atsWins: summary.cumulativeAtsWins,
    atsLosses: summary.cumulativeAtsLosses,
    atsPushes: summary.cumulativeAtsPushes,
  };
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const requestedLeagueId = String(searchParams.get("leagueId") ?? "").trim();

  const leagues = await prisma.league.findMany({
    include: {
      season: { select: { year: true } },
      leagueUsers: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
        },
        orderBy: [{ draftPosition: "asc" }, { createdAt: "asc" }],
      },
      draftPicks: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              name: true,
            },
          },
          team: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ pickedAt: "asc" }, { round: "asc" }, { pickNumber: "asc" }],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const league = requestedLeagueId
    ? leagues.find((entry) => entry.id === requestedLeagueId) ?? null
    : selectActiveLeague(leagues);

  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const season = league.season?.year ?? CURRENT_SEASON;
  const managers = buildSeasonManagers(season, league.leagueUsers, league.draftPicks);

  const periodPayloads: SeasonPeriodPayload[] = await Promise.all([
    ...SEASON_PERIODS.map(async (period) => {
      const week = Number(period.value);
      const payload = await getWeekData(season, week);
      return {
        periodValue: week,
        games: payload.games,
        lines: payload.lines,
      };
    }),
    (async () => {
      const payload = await getPostseasonData(season);
      return {
        periodValue: POSTSEASON_PERIOD.value,
        games: payload.games,
        lines: payload.lines,
        cfpMatchupInfo: payload.cfpMatchupInfo,
      };
    })(),
  ]);

  const summaries = buildSeasonSummaries(managers, periodPayloads);
  const postseasonSummaries = summaries.periodSummaries[getSeasonPeriodKey(POSTSEASON_PERIOD.value)] ?? [];
  const postseasonByManagerKey = new Map<string, PeriodSummary>(
    postseasonSummaries.map((summary) => [summary.manager.key, summary] as const),
  );

  const perPeriodByManagerKey = new Map<string, Record<string, number>>();
  for (const period of [...SEASON_PERIODS.map((entry) => entry.value), POSTSEASON_PERIOD.value]) {
    const periodKey = getSeasonPeriodKey(period);
    const entries = summaries.periodSummaries[periodKey] ?? [];
    for (const summary of entries) {
      if (!perPeriodByManagerKey.has(summary.manager.key)) {
        perPeriodByManagerKey.set(summary.manager.key, {});
      }
      perPeriodByManagerKey.get(summary.manager.key)![periodKey] = summary.weekly.weeklyPoints;
    }
  }

  return NextResponse.json({
    season,
    leagueId: league.id,
    generatedAt: new Date().toISOString(),
    managers: managers.map((manager) => {
      const postseasonSummary = postseasonByManagerKey.get(manager.key) ?? null;
      const teamDiagnostics = manager.teams.map((team) => {
        const canonicalizedTeam = canonicalizeTeamName(team);
        const teamSummary = summaries.teamSummaries[canonicalizedTeam] ?? null;
        return {
          draftTeam: team,
          canonicalizedTeam,
          teamPoints: teamSummary?.points ?? 0,
          record: teamSummary
            ? {
                wins: teamSummary.wins,
                losses: teamSummary.losses,
                pushes: teamSummary.pushes,
                atsWins: teamSummary.atsWins,
                atsLosses: teamSummary.atsLosses,
                atsPushes: teamSummary.atsPushes,
              }
            : null,
        };
      });

      return {
        managerKey: manager.key,
        displayName: manager.displayName,
        userId: manager.userId,
        cumulative: toRecord(postseasonSummary),
        weeklyPointsByPeriod: perPeriodByManagerKey.get(manager.key) ?? {},
        teams: teamDiagnostics,
      };
    }),
  });
}
