import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isLikelySameManager } from "@/lib/manager-name-match";
import { prisma } from "@/lib/prisma";
import AdminPanel from "@/components/admin-panel";

export default async function AdminRoutePage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const leagues = await prisma.league.findMany({
    include: {
      leagueUsers: {
        include: { user: true },
        orderBy: { draftPosition: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const historyEntries = await prisma.leagueHistoryEntry.findMany({
    where: { season: 2025 },
    include: { user: true },
  });

  const historyManagers = historyEntries.reduce<Array<{
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    email: string | null;
    userId: string | null;
  }>>((acc, entry) => {
    const displayName =
      entry.user?.firstName && entry.user?.lastName
        ? `${entry.user.firstName} ${entry.user.lastName}`
        : `${entry.firstName ?? ""} ${entry.lastName ?? ""}`.trim();

    const existing = acc.find((candidate) =>
      isLikelySameManager(
        {
          userId: entry.userId,
          email: entry.user?.email ?? null,
          firstName: entry.user?.firstName ?? entry.firstName,
          lastName: entry.user?.lastName ?? entry.lastName,
          displayName,
        },
        candidate,
      ),
    );

    if (existing) {
      if (!existing.email && entry.user?.email) {
        existing.email = entry.user.email;
      }
      if (!existing.userId && entry.userId) {
        existing.userId = entry.userId;
      }
      return acc;
    }

    acc.push({
      firstName: entry.user?.firstName ?? entry.firstName,
      lastName: entry.user?.lastName ?? entry.lastName,
      displayName,
      email: entry.user?.email ?? null,
      userId: entry.userId,
    });
    return acc;
  }, []);

  const leaguesWithMatchedEmails = leagues.map((league) => ({
    ...league,
    leagueUsers: league.leagueUsers.map((leagueUser) => {
      const matchedManager = historyManagers.find((manager) =>
        isLikelySameManager(
          {
            userId: leagueUser.userId,
            email: leagueUser.user.email,
            firstName: leagueUser.user.firstName,
            lastName: leagueUser.user.lastName,
            displayName: leagueUser.user.name,
          },
          manager,
        ),
      );

      return {
        ...leagueUser,
        user: {
          ...leagueUser.user,
          matchedEmail: matchedManager?.email ?? leagueUser.user.email,
        },
      };
    }),
  }));

  const allTeams = await prisma.team.findMany({
    include: { conference: true },
    orderBy: [{ conference: { name: "asc" } }, { name: "asc" }],
  });
  // Only show teams that have a conference assigned
  const teams = allTeams.filter((t) => t.conference !== null) as (typeof allTeams[number] & { conference: NonNullable<typeof allTeams[number]["conference"]> })[];

  return <AdminPanel leagues={leaguesWithMatchedEmails} teams={teams} />;
}
