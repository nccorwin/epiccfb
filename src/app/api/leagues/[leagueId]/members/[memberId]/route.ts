import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leagueId: string; memberId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { leagueId, memberId } = await params;
  const body = await request.json();
  const draftPosition = Number(body?.draftPosition);

  if (!Number.isFinite(draftPosition) || draftPosition <= 0) {
    return NextResponse.json({ error: "Draft position must be a positive number." }, { status: 400 });
  }

  const membership = await prisma.leagueUser.findFirst({ where: { leagueId, userId: memberId } });
  if (!membership) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const updated = await prisma.leagueUser.update({
    where: { id: membership.id },
    data: { draftPosition },
  });

  return NextResponse.json(updated);
}
