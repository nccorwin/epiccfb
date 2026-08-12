import { NextResponse } from "next/server";
import { UserRole, type Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DraftStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";

function getSettingsObject(settings: Prisma.JsonValue | null) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {} as Record<string, Prisma.JsonValue>;
  }

  return settings as Record<string, Prisma.JsonValue>;
}

function getDraftStatus(settings: Prisma.JsonValue | null): DraftStatus {
  const value = getSettingsObject(settings).draftStatus;
  if (value === "IN_PROGRESS" || value === "PAUSED" || value === "COMPLETED") {
    return value;
  }
  return "NOT_STARTED";
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const leagueId = String(body?.leagueId ?? "").trim();

  if (!leagueId) {
    return NextResponse.json({ error: "leagueId is required." }, { status: 400 });
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const draftStatus = getDraftStatus(league.settings);
  if (draftStatus === "NOT_STARTED") {
    return NextResponse.json({ error: "There are no picks to undo yet." }, { status: 409 });
  }

  const latestPick = await prisma.draftPick.findFirst({
    where: { leagueId },
    orderBy: [{ round: "desc" }, { pickNumber: "desc" }],
  });

  if (!latestPick) {
    return NextResponse.json({ error: "There are no picks to undo yet." }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.draftPick.delete({ where: { id: latestPick.id } });

    if (latestPick.userId && latestPick.teamId) {
      await tx.roster.deleteMany({
        where: { leagueId, userId: latestPick.userId, teamId: latestPick.teamId },
      });
    }

    const settings = getSettingsObject(league.settings);
    const nextSettings = {
      ...settings,
      draftStatus: "IN_PROGRESS" as DraftStatus,
      currentPickStartedAt: new Date().toISOString(),
    };

    const updatedLeague = await tx.league.update({
      where: { id: leagueId },
      data: { settings: nextSettings },
      select: { id: true, settings: true },
    });

    return { updatedLeague, undonePick: latestPick };
  });

  return NextResponse.json({
    leagueId: result.updatedLeague.id,
    draftStatus: "IN_PROGRESS",
    undonePick: {
      round: result.undonePick.round,
      pickNumber: result.undonePick.pickNumber,
      userId: result.undonePick.userId,
      teamId: result.undonePick.teamId,
    },
  });
}
