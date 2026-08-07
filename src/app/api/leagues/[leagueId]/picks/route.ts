import { NextResponse } from "next/server";
import { UserRole, type Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDraftPickNumber, resolveRosterSlotTypeForSelection, validateRosterSelection } from "@/lib/league-rules";

const DRAFT_ROUNDS = 10;
type DraftStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";

function getDraftSettings(settings: Prisma.JsonValue | null): {
  draftStatus: DraftStatus;
  currentPickStartedAt: string | null;
} {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return { draftStatus: "NOT_STARTED", currentPickStartedAt: null };
  }

  const settingsObject = settings as Record<string, Prisma.JsonValue>;
  const rawStatus = typeof settingsObject.draftStatus === "string" ? settingsObject.draftStatus : "NOT_STARTED";
  const draftStatus: DraftStatus =
    rawStatus === "IN_PROGRESS" || rawStatus === "PAUSED" || rawStatus === "COMPLETED"
      ? rawStatus
      : "NOT_STARTED";
  const currentPickStartedAt = typeof settingsObject.currentPickStartedAt === "string"
    ? settingsObject.currentPickStartedAt
    : null;

  return { draftStatus, currentPickStartedAt };
}

function getPickerUserIdForPickIndex(
  pickIndex: number,
  orderedLeagueUsers: Array<{ userId: string }>,
) {
  const userCount = orderedLeagueUsers.length;
  if (userCount === 0) {
    return null;
  }

  const round = Math.floor(pickIndex / userCount) + 1;
  const pickWithinRound = pickIndex % userCount;
  const roundOrder = round % 2 === 1 ? orderedLeagueUsers : [...orderedLeagueUsers].reverse();
  return roundOrder[pickWithinRound]?.userId ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const { leagueId } = await params;
  const picks = await prisma.draftPick.findMany({
    where: { leagueId },
    include: {
      team: {
        include: {
          conference: true,
        },
      },
      user: true,
    },
    orderBy: [{ round: "asc" }, { pickNumber: "asc" }],
  });

  return NextResponse.json(picks);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { leagueId } = await params;
  const body = await request.json();
  const requestedUserId = String(body?.userId ?? "").trim();
  const teamId = String(body?.teamId ?? "").trim();

  if (!teamId) {
    return NextResponse.json({ error: "teamId is required." }, { status: 400 });
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      leagueUsers: {
        orderBy: [{ draftPosition: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const { draftStatus } = getDraftSettings(league.settings);
  if (draftStatus !== "IN_PROGRESS") {
    return NextResponse.json({ error: "The draft has not started or is currently paused." }, { status: 409 });
  }

  const orderedLeagueUsers = league.leagueUsers.filter((entry) => entry.draftPosition != null);
  const userCount = orderedLeagueUsers.length;
  if (userCount === 0) {
    return NextResponse.json({ error: "Draft order is incomplete. Ask an admin to set every manager's draft position." }, { status: 409 });
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

  const pickCount = await prisma.draftPick.count({ where: { leagueId } });
  const totalPickCount = userCount * DRAFT_ROUNDS;
  if (pickCount >= totalPickCount) {
    return NextResponse.json({ error: "The draft is already complete." }, { status: 409 });
  }

  const currentPickerUserId = getPickerUserIdForPickIndex(pickCount, orderedLeagueUsers);
  if (!currentPickerUserId) {
    return NextResponse.json({ error: "Unable to determine the current picker." }, { status: 409 });
  }

  const userId = currentUser.role === UserRole.ADMIN
    ? requestedUserId || currentPickerUserId
    : currentUser.id;

  if (userId !== currentPickerUserId && currentUser.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "It is not your turn to pick." }, { status: 403 });
  }

  if (currentUser.role === UserRole.ADMIN && requestedUserId && requestedUserId !== currentPickerUserId) {
    return NextResponse.json({ error: "Admin submissions must target the manager currently on the clock." }, { status: 409 });
  }

  const membership = await prisma.leagueUser.findUnique({ where: { leagueId_userId: { leagueId, userId } } });
  if (!membership) {
    return NextResponse.json({ error: "User is not part of this league." }, { status: 403 });
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

  const round = Math.floor(pickCount / Math.max(userCount, 1)) + 1;
  const pickWithinRound = pickCount % Math.max(userCount, 1) + 1;
  const pickNumber = getDraftPickNumber(round, pickWithinRound, userCount);

  const transactionResult = await prisma.$transaction(async (tx) => {
    const pick = await tx.draftPick.create({
      data: {
        leagueId,
        round,
        pickNumber,
        userId,
        teamId,
        pickedAt: new Date(),
      },
    });

    const roster = await tx.roster.create({
      data: {
        leagueId,
        userId,
        teamId,
        slotType,
      },
    });

    const nextPickCount = pickCount + 1;
    const currentSettings =
      league.settings && typeof league.settings === "object" && !Array.isArray(league.settings)
        ? league.settings
        : {};
    const nextSettings = {
      ...currentSettings,
      draftStatus: nextPickCount >= totalPickCount ? "COMPLETED" : "IN_PROGRESS",
      currentPickStartedAt: nextPickCount >= totalPickCount ? null : new Date().toISOString(),
    };

    await tx.league.update({
      where: { id: leagueId },
      data: { settings: nextSettings },
    });

    return { pick, roster, draftStatus: nextSettings.draftStatus, currentPickStartedAt: nextSettings.currentPickStartedAt };
  });

  return NextResponse.json(transactionResult);
}
