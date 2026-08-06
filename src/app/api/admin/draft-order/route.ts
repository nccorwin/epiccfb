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
  const order: { userId: string; draftPosition: number }[] = body?.order ?? [];

  if (!leagueId || !Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: "leagueId and a non-empty order array are required." }, { status: 400 });
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  // Validate positions are unique positive integers
  const positions = order.map((o) => Number(o.draftPosition));
  const allPositive = positions.every((p) => Number.isFinite(p) && p > 0);
  const allUnique = new Set(positions).size === positions.length;
  if (!allPositive || !allUnique) {
    return NextResponse.json({ error: "Each draftPosition must be a unique positive integer." }, { status: 400 });
  }

  await prisma.$transaction(
    order.map(({ userId, draftPosition }) =>
      prisma.leagueUser.updateMany({
        where: { leagueId, userId },
        data: { draftPosition },
      }),
    ),
  );

  const updated = await prisma.leagueUser.findMany({
    where: { leagueId },
    include: { user: true },
    orderBy: { draftPosition: "asc" },
  });

  return NextResponse.json(updated);
}
