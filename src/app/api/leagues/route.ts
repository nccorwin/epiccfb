import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const leagues = await prisma.league.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      season: true,
      leagueUsers: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              name: true,
              role: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(leagues);
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const seasonYear = Number(body?.seasonYear ?? new Date().getFullYear());
  const ownerEmail = String(body?.ownerEmail ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "League name is required." }, { status: 400 });
  }

  let season = await prisma.season.findFirst({ where: { year: seasonYear } });
  if (!season) {
    season = await prisma.season.create({
      data: {
        year: seasonYear,
        startDate: new Date(`${seasonYear}-08-01T00:00:00.000Z`),
        endDate: new Date(`${seasonYear + 1}-01-15T00:00:00.000Z`),
      },
    });
  }

  const user = ownerEmail
    ? await prisma.user.upsert({
        where: { email: ownerEmail },
        update: {},
        create: {
          email: ownerEmail,
          name: ownerEmail.split("@")[0],
        },
      })
    : undefined;

  const league = await prisma.league.create({
    data: {
      name,
      seasonId: season.id,
      settings: {
        draftType: "snake",
        rosterRequirements: [
          { slot: "BIG_TEN", count: 1 },
          { slot: "BIG_TWELVE", count: 1 },
          { slot: "SEC", count: 1 },
          { slot: "ACC", count: 1 },
          { slot: "GROUP_OF_FIVE", count: 2 },
          { slot: "FCS", count: 2 },
          { slot: "WILDCARD", count: 2 },
        ],
      },
      leagueUsers: {
        create: user
          ? [{ userId: user.id, draftPosition: 1 }]
          : [],
      },
    },
  });

  return NextResponse.json(league);
}
