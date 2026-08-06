import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const { leagueId } = await params;
  const body = await request.json();
  const email = String(body?.email ?? "").trim();
  const draftPosition = Number(body?.draftPosition ?? 0);

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: email.split("@")[0],
    },
  });

  const membership = await prisma.leagueUser.upsert({
    where: {
      leagueId_userId: {
        leagueId,
        userId: user.id,
      },
    },
    update: {
      draftPosition: draftPosition || undefined,
    },
    create: {
      leagueId,
      userId: user.id,
      draftPosition: draftPosition || undefined,
    },
  });

  return NextResponse.json({ user, membership });
}
