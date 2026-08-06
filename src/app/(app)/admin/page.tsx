import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
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

  const allTeams = await prisma.team.findMany({
    include: { conference: true },
    orderBy: [{ conference: { name: "asc" } }, { name: "asc" }],
  });
  // Only show teams that have a conference assigned
  const teams = allTeams.filter((t) => t.conference !== null) as (typeof allTeams[number] & { conference: NonNullable<typeof allTeams[number]["conference"]> })[];

  return <AdminPanel leagues={leagues} teams={teams} />;
}
