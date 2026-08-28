import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

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

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      role: user.role,
    },
    membership,
  });
}
