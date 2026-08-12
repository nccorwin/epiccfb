import { NextResponse } from "next/server";
import { UserRole, type Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveRosterSlotTypeForSelection, validateRosterSelection } from "@/lib/league-rules";

type DraftStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";

type RemoveInstruction = { pickId: string };
type InsertInstruction = { round: number; pickNumber: number; userId: string; teamId: string; pickedAt?: string };

function getSettingsObject(settings: Prisma.JsonValue | null) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {} as Record<string, Prisma.JsonValue>;
  }

  return settings as Record<string, Prisma.JsonValue>;
}

/**
 * Admin-only manual draft-correction tool.
 *
 * Lets an admin remove specific erroneous picks (by pick id) and insert
 * specific missing/replacement picks (by round + pickNumber + userId +
 * teamId), in a single transaction. This is intended for recovering from
 * data issues (e.g. a pick removed by mistake, or a duplicate pick created
 * by a bug) without disrupting every other pick already on the board.
 * Picks are removed by their unique id (not round/pickNumber) since a data
 * corruption incident can leave two picks sharing the same round and
 * pickNumber, which would make a round/pickNumber-based lookup ambiguous.
 * The operation is idempotent: removing a pick that no longer exists, or
 * inserting a pick that already exists, is a no-op rather than an error, so
 * it is safe to retry.
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const leagueId = String(body?.leagueId ?? "").trim();
  const remove: RemoveInstruction[] = Array.isArray(body?.remove) ? body.remove : [];
  const insert: InsertInstruction[] = Array.isArray(body?.insert) ? body.insert : [];

  if (!leagueId) {
    return NextResponse.json({ error: "leagueId is required." }, { status: 400 });
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const removed: RemoveInstruction[] = [];
  const inserted: InsertInstruction[] = [];
  const skipped: Array<{ instruction: InsertInstruction; reason: string }> = [];

  await prisma.$transaction(async (tx) => {
    for (const instruction of remove) {
      const existingPick = await tx.draftPick.findFirst({
        where: { id: instruction.pickId, leagueId },
      });
      if (!existingPick) {
        continue;
      }

      await tx.draftPick.delete({ where: { id: existingPick.id } });
      if (existingPick.userId && existingPick.teamId) {
        await tx.roster.deleteMany({
          where: { leagueId, userId: existingPick.userId, teamId: existingPick.teamId },
        });
      }
      removed.push(instruction);
    }

    for (const instruction of insert) {
      const alreadyExists = await tx.draftPick.findFirst({
        where: {
          leagueId,
          round: instruction.round,
          pickNumber: instruction.pickNumber,
          userId: instruction.userId,
          teamId: instruction.teamId,
        },
      });
      if (alreadyExists) {
        continue;
      }

      const teamAlreadyPicked = await tx.draftPick.findFirst({ where: { leagueId, teamId: instruction.teamId } });
      if (teamAlreadyPicked) {
        skipped.push({ instruction, reason: "That team has already been drafted in this league." });
        continue;
      }

      const team = await tx.team.findUnique({ where: { id: instruction.teamId }, include: { conference: true } });
      if (!team) {
        skipped.push({ instruction, reason: "Team not found." });
        continue;
      }

      const existingSelections = await tx.roster.findMany({
        where: { leagueId, userId: instruction.userId },
        include: { team: { include: { conference: true } } },
      });
      const mappedSelections = existingSelections.map((entry) => ({ slotType: entry.slotType, team: entry.team }));
      const slotType = resolveRosterSlotTypeForSelection(team, mappedSelections);

      if (!slotType || !validateRosterSelection(team, mappedSelections)) {
        skipped.push({ instruction, reason: "This team does not fit the roster requirements for that user." });
        continue;
      }

      await tx.draftPick.create({
        data: {
          leagueId,
          round: instruction.round,
          pickNumber: instruction.pickNumber,
          userId: instruction.userId,
          teamId: instruction.teamId,
          pickedAt: instruction.pickedAt ? new Date(instruction.pickedAt) : new Date(),
        },
      });
      await tx.roster.create({
        data: { leagueId, userId: instruction.userId, teamId: instruction.teamId, slotType },
      });
      inserted.push(instruction);
    }

    const settings = getSettingsObject(league.settings);
    const currentStatus = settings.draftStatus;
    const nextSettings = {
      ...settings,
      draftStatus: (currentStatus === "COMPLETED" ? "IN_PROGRESS" : currentStatus ?? "IN_PROGRESS") as DraftStatus,
      currentPickStartedAt: new Date().toISOString(),
    };

    await tx.league.update({ where: { id: leagueId }, data: { settings: nextSettings } });
  });

  const updatedPicks = await prisma.draftPick.findMany({
    where: { leagueId },
    include: { team: { include: { conference: true } }, user: true },
    orderBy: [{ round: "asc" }, { pickNumber: "asc" }],
  });

  return NextResponse.json({ removed, inserted, skipped, picks: updatedPicks });
}
