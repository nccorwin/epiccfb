import { NextResponse } from "next/server";
import { calculateTeamGamePoints } from "@/lib/scoring";
import { calculateGameBonusPoints, calculatePostseasonGameBonusPoints, createPostseasonBonusTracker } from "@/lib/game-bonus";
import { CFDB_BASE_URL, getGameResultsForWeek, getLineDataForWeek, getPostseasonData, getWeekData } from "@/lib/cfdb";
import { CURRENT_SEASON } from "@/lib/current-season";
import { canonicalizeTeamName } from "@/lib/team-name";

function normalizeTeamName(teamName: string) {
  return canonicalizeTeamName(teamName);
}

function findLineForGame(lines: Awaited<ReturnType<typeof getLineDataForWeek>>, game: Awaited<ReturnType<typeof getGameResultsForWeek>>[number]) {
  const normalizedPair = `${normalizeTeamName(game.homeTeam)}|${normalizeTeamName(game.awayTeam)}`;

  return lines.find((line) => {
    const linePair = `${normalizeTeamName(line.homeTeam)}|${normalizeTeamName(line.awayTeam)}`;
    return linePair === normalizedPair;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = Number(searchParams.get("season") ?? String(CURRENT_SEASON));
  const week = Number(searchParams.get("week") ?? "1");
  const action = searchParams.get("type") ?? searchParams.get("action") ?? "info";

  const configured = Boolean(process.env.CFDB_API_KEY);
  const baseUrl = CFDB_BASE_URL;

  if (!configured) {
    return NextResponse.json({
      provider: "CFDB",
      configured: false,
      baseUrl,
      message: "CFDB_API_KEY is not configured.",
    });
  }

  try {
    if (action === "lines") {
      return NextResponse.json(await getLineDataForWeek(season, week));
    }

    if (action === "scores") {
      return NextResponse.json(await getGameResultsForWeek(season, week));
    }

    if (action === "weekData") {
      return NextResponse.json(await getWeekData(season, week));
    }

    if (action === "weekScoring") {
      const { lines, games, priorFcsFirstRoundTeams } = await getWeekData(season, week);
      const tracker = createPostseasonBonusTracker();
      for (const team of Array.isArray(priorFcsFirstRoundTeams) ? priorFcsFirstRoundTeams : []) {
        tracker.fcsAppearanceTeams.add(team);
      }
      const scored = [...games].sort((left, right) => {
        const leftDate = new Date(left.startDate).getTime();
        const rightDate = new Date(right.startDate).getTime();
        if (leftDate !== rightDate) {
          return leftDate - rightDate;
        }
        return left.id - right.id;
      }).map((game) => {
        const line = findLineForGame(lines, game);
        const primaryLine = line?.lines[0];
        const spreadHome = primaryLine?.spread != null ? primaryLine.spread : null;
        const spreadAway = primaryLine?.spread != null ? -primaryLine.spread : null;
        const breakdown = calculateTeamGamePoints({
          homeScore: game.homePoints ?? 0,
          awayScore: game.awayPoints ?? 0,
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

        return {
          matchupId: game.id,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          homeScore: game.homePoints,
          awayScore: game.awayPoints,
          line,
          points: {
            home: {
              ...breakdown.home,
              bonusPoints: bonusPoints.home,
              totalPoints: breakdown.home.totalPoints + bonusPoints.home,
            },
            away: {
              ...breakdown.away,
              bonusPoints: bonusPoints.away,
              totalPoints: breakdown.away.totalPoints + bonusPoints.away,
            },
          },
        };
      });

      return NextResponse.json({ season, week, scored });
    }

    if (action === "postseasonData") {
      return NextResponse.json(await getPostseasonData(season));
    }

    return NextResponse.json({
      provider: "CFDB",
      configured: true,
      baseUrl,
      season,
      week,
      supportedActions: ["lines", "scores", "weekData", "weekScoring", "postseasonData"],
    });
  } catch (error) {
    return NextResponse.json(
      {
        provider: "CFDB",
        configured: true,
        baseUrl,
        season,
        week,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}
