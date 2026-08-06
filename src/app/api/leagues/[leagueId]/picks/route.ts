import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveRosterSlotTypeForSelection, validateRosterSelection } from "@/lib/league-rules";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const { leagueId } = await params;
  const picks = await prisma.draftPick.findMany({
    where: { leagueId },
    include: { team: true, user: true },
    orderBy: [{ round: "asc" }, { pickNumber: "asc" }],
  });

  return NextResponse.json(picks);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const { leagueId } = await params;
  const body = await request.json();
  const userId = String(body?.userId ?? "").trim();
  const teamId = String(body?.teamId ?? "").trim();

  if (!userId || !teamId) {
    return NextResponse.json({ error: "Both userId and teamId are required." }, { status: 400 });
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const membership = await prisma.leagueUser.findUnique({ where: { leagueId_userId: { leagueId, userId } } });
  if (!membership) {
    return NextResponse.json({ error: "User is not part of this league." }, { status: 403 });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { conference: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found." }, { status: 404 });
  }

  const existingPick = await prisma.draftPick.findFirst({ where: { leagueId, teamId } });
  if (existingPick) {
    return NextResponse.json({ error: "That team has already been selected in this league." }, { status: 409 });
  }

  const existingSelections = await prisma.roster.findMany({
    where: { leagueId, userId },
    include: {
      team: {
        include: {
          conference: true,
        },
      },
    },
  });

  const slotType = resolveRosterSlotTypeForSelection(team, existingSelections.map((entry) => ({
    slotType: entry.slotType,
    team: entry.team,
  })));
  if (!slotType || !validateRosterSelection(team, existingSelections.map((entry) => ({
    slotType: entry.slotType,
    team: entry.team,
  })))) {
    return NextResponse.json({ error: "This team does not fit the roster requirements for that user." }, { status: 409 });
  }

  const pickCount = await prisma.draftPick.count({ where: { leagueId } });
  const userCount = await prisma.leagueUser.count({ where: { leagueId } });
  const round = Math.floor(pickCount / Math.max(userCount, 1)) + 1;
  const pickWithinRound = pickCount % Math.max(userCount, 1) + 1;
  const pickNumber = pickWithinRound;

  const [pick, roster] = await prisma.$transaction([
    prisma.draftPick.create({
      data: {
        leagueId,
        round,
        pickNumber,
        userId,
        teamId,
        pickedAt: new Date(),
      },
    }),
    prisma.roster.create({
      data: {
        leagueId,
        userId,
        teamId,
        slotType,
      },
    }),
  ]);

  return NextResponse.json({ pick, roster });
}
