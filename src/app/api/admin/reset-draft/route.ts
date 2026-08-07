import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const leagueId = String(body?.leagueId ?? "").trim();

  if (!leagueId) {
    return NextResponse.json({ error: "leagueId is required." }, { status: 400 });
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, name: true, settings: true },
  });

  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const settings =
    league.settings && typeof league.settings === "object" && !Array.isArray(league.settings)
      ? league.settings
      : {};

  const result = await prisma.$transaction(async (tx) => {
    const deletedPicks = await tx.draftPick.deleteMany({ where: { leagueId } });
    const deletedRosters = await tx.roster.deleteMany({ where: { leagueId } });

    await tx.league.update({
      where: { id: leagueId },
      data: {
        settings: {
          ...settings,
          draftStatus: "NOT_STARTED",
          currentPickStartedAt: null,
        },
      },
    });

    return {
      deletedPicks: deletedPicks.count,
      deletedRosters: deletedRosters.count,
    };
  });

  return NextResponse.json({
    message: `Draft reset for ${league.name}.`,
    ...result,
  });
}
