import { NextResponse } from "next/server";
import { isLikelySameManager } from "@/lib/manager-name-match";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const season = Number(searchParams.get("season") ?? "2025");

  if (!Number.isFinite(season) || season < 1900) {
    return NextResponse.json({ error: "A valid season is required." }, { status: 400 });
  }

  const entries = await prisma.leagueHistoryEntry.findMany({
    where: { season },
    include: { user: true },
    orderBy: [{ finalRank: "asc" }, { teamName: "asc" }],
  });

  const managers = new Map<
    string,
    {
      key: string;
      season: number;
      finalRank: number;
      totalPoints: number;
      firstName: string | null;
      lastName: string | null;
      userId: string | null;
      email: string | null;
      displayName: string;
      teams: string[];
    }
  >();

  for (const entry of entries) {
    const matchedExisting = Array.from(managers.values()).find((manager) =>
      isLikelySameManager(
        {
          userId: entry.userId,
          email: entry.user?.email ?? null,
          firstName: entry.user?.firstName ?? entry.firstName,
          lastName: entry.user?.lastName ?? entry.lastName,
          displayName: entry.user?.name ?? `${entry.firstName ?? ""} ${entry.lastName ?? ""}`.trim(),
        },
        manager,
      ),
    );
    const key = matchedExisting?.key ?? entry.userId ?? `${entry.firstName ?? ""}-${entry.lastName ?? ""}`.toLowerCase();
    const userName =
      entry.user?.firstName && entry.user?.lastName
        ? `${entry.user.firstName} ${entry.user.lastName}`
        : entry.user?.name;
    const csvName = `${entry.firstName ?? ""} ${entry.lastName ?? ""}`.trim();
    const displayName = userName ?? (csvName || "Unknown manager");

    const existing = managers.get(key);
    if (!existing) {
      managers.set(key, {
        key,
        season: entry.season,
        finalRank: entry.finalRank,
        totalPoints: Number(entry.totalPoints),
        firstName: entry.firstName ?? entry.user?.firstName ?? null,
        lastName: entry.lastName ?? entry.user?.lastName ?? null,
        userId: entry.userId,
        email: entry.user?.email ?? null,
        displayName,
        teams: [entry.teamName],
      });
      continue;
    }

    existing.teams.push(entry.teamName);
    if (!existing.userId && entry.userId) {
      existing.userId = entry.userId;
    }
    if (!existing.email && entry.user?.email) {
      existing.email = entry.user.email;
    }
    if ((!existing.firstName || !existing.lastName) && (entry.user?.firstName || entry.user?.lastName)) {
      existing.firstName = entry.user?.firstName ?? existing.firstName;
      existing.lastName = entry.user?.lastName ?? existing.lastName;
    }
    if (entry.user?.firstName && entry.user?.lastName) {
      existing.displayName = `${entry.user.firstName} ${entry.user.lastName}`;
    }
  }

  const data = Array.from(managers.values())
    .map((manager) => ({
      ...manager,
      teams: manager.teams.sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.finalRank - right.finalRank);

  return NextResponse.json({ season, managers: data });
}
