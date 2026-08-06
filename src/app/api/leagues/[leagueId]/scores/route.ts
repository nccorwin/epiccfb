import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateTeamGamePoints } from "@/lib/scoring";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const { leagueId } = await params;
  const { searchParams } = new URL(request.url);
  const weekNumber = Number(searchParams.get("weekNumber") ?? 1);

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const week = await prisma.week.findFirst({
    where: {
      seasonId: league.seasonId,
      weekNumber,
    },
    include: {
      games: {
        include: {
          result: true,
          lines: true,
        },
      },
    },
  });

  if (!week) {
    return NextResponse.json({ error: "Week not found." }, { status: 404 });
  }

  const rosters = await prisma.roster.findMany({
    where: { leagueId },
    include: { team: true, user: true },
  });

  const scores = rosters.map((roster) => {
    let points = 0;

    for (const game of week.games) {
      if (game.homeTeamId !== roster.teamId && game.awayTeamId !== roster.teamId) {
        continue;
      }

      const line = game.lines[0];
      const result = calculateTeamGamePoints({
        homeScore: game.result?.homeScore ?? 0,
        awayScore: game.result?.awayScore ?? 0,
        spreadHome: line?.spreadHome,
        spreadAway: line?.spreadAway,
      });

      points += roster.teamId === game.homeTeamId ? result.home.totalPoints : result.away.totalPoints;
    }

    return {
      userId: roster.userId,
      userName: roster.user.name,
      teamId: roster.teamId,
      teamName: roster.team.name,
      points,
    };
  });

  return NextResponse.json({ weekNumber, scores });
}
