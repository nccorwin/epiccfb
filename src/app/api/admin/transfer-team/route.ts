import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveRosterSlotTypeForSelection } from "@/lib/league-rules";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const leagueId = String(body?.leagueId ?? "").trim();
  const fromUserId = String(body?.fromUserId ?? "").trim();
  const toUserId = String(body?.toUserId ?? "").trim();
  const dropTeamId = String(body?.dropTeamId ?? "").trim();
  const pickupTeamId = String(body?.pickupTeamId ?? "").trim();

  if (!leagueId || !fromUserId || !toUserId || !dropTeamId || !pickupTeamId) {
    return NextResponse.json(
      { error: "leagueId, fromUserId, toUserId, dropTeamId, and pickupTeamId are all required." },
      { status: 400 },
    );
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return NextResponse.json({ error: "League not found." }, { status: 404 });

  // Verify both users are in the league
  const [fromMembership, toMembership] = await Promise.all([
    prisma.leagueUser.findUnique({ where: { leagueId_userId: { leagueId, userId: fromUserId } } }),
    prisma.leagueUser.findUnique({ where: { leagueId_userId: { leagueId, userId: toUserId } } }),
  ]);
  if (!fromMembership) return NextResponse.json({ error: "fromUser is not in this league." }, { status: 404 });
  if (!toMembership) return NextResponse.json({ error: "toUser is not in this league." }, { status: 404 });

  // Verify dropTeam is currently on fromUser's roster
  const dropRosterEntry = await prisma.roster.findFirst({
    where: { leagueId, userId: fromUserId, teamId: dropTeamId },
  });
  if (!dropRosterEntry) {
    return NextResponse.json({ error: "The dropped team is not on that user's roster." }, { status: 404 });
  }

  // Verify pickupTeam exists and is not already owned in this league
  const pickupTeam = await prisma.team.findUnique({
    where: { id: pickupTeamId },
    include: { conference: true },
  });
  if (!pickupTeam) return NextResponse.json({ error: "Pickup team not found." }, { status: 404 });

  const pickupAlreadyOwned = await prisma.roster.findFirst({
    where: { leagueId, teamId: pickupTeamId },
  });
  if (pickupAlreadyOwned) {
    return NextResponse.json({ error: "That team is already owned in this league." }, { status: 409 });
  }

  // Determine roster slot for the pickup team on the receiving user
  const toUserRoster = await prisma.roster.findMany({
    where: { leagueId, userId: toUserId },
    include: { team: { include: { conference: true } } },
  });

  const slotType = resolveRosterSlotTypeForSelection(
    pickupTeam,
    toUserRoster.map((r) => ({ slotType: r.slotType, team: r.team })),
  );
  if (!slotType) {
    return NextResponse.json(
      { error: "The pickup team does not fit any remaining roster slot for the receiving user." },
      { status: 409 },
    );
  }

  // Execute in a transaction: remove drop team from fromUser, add pickup to toUser
  await prisma.$transaction([
    // Remove roster entry for dropped team
    prisma.roster.delete({ where: { id: dropRosterEntry.id } }),
    // Remove the draft pick for dropped team (keeps history clean)
    prisma.draftPick.deleteMany({ where: { leagueId, userId: fromUserId, teamId: dropTeamId } }),
    // Add pickup team to toUser roster
    prisma.roster.create({
      data: { leagueId, userId: toUserId, teamId: pickupTeamId, slotType },
    }),
    // Create a draft pick record for the pickup (round 0 = admin transaction)
    prisma.draftPick.create({
      data: {
        leagueId,
        userId: toUserId,
        teamId: pickupTeamId,
        round: 0,
        pickNumber: 0,
        pickedAt: new Date(),
      },
    }),
  ]);

  return NextResponse.json({ success: true, droppedTeamId: dropTeamId, pickedUpTeamId: pickupTeamId });
}
