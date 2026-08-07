import { prisma } from "@/lib/prisma";

type HistoryRecord = {
  id: string;
  season: number;
  firstName: string | null;
  lastName: string | null;
  finalRank: number;
  totalPoints: number;
  teamName: string;
  user: { id: string; firstName: string | null; lastName: string | null; name: string | null; email: string } | null;
};

type SeasonSummary = {
  season: number;
  managers: Array<{
    key: string;
    displayName: string;
    finalRank: number;
    totalPoints: number;
    teams: string[];
    userId: string | null;
  }>;
};

function displayName(record: HistoryRecord) {
  const fromUser = record.user;
  if (fromUser?.firstName && fromUser?.lastName) {
    return `${fromUser.firstName} ${fromUser.lastName}`;
  }
  if (record.firstName && record.lastName) {
    return `${record.firstName} ${record.lastName}`;
  }
  if (fromUser?.name) {
    return fromUser.name;
  }
  return "Unmatched manager";
}

export default async function LeagueHistoryPage({ isAdmin = false }: { isAdmin?: boolean }) {
  const records = await prisma.leagueHistoryEntry.findMany({
    include: { user: true },
    orderBy: [{ season: "desc" }, { finalRank: "asc" }, { teamName: "asc" }],
  });

  const seasons = new Map<number, Map<string, SeasonSummary["managers"][number]>>();

  for (const record of records) {
    const season = record.season;
    if (!seasons.has(season)) {
      seasons.set(season, new Map());
    }

    const seasonMap = seasons.get(season)!;
    const key = record.userId ?? `${record.firstName ?? ""}-${record.lastName ?? ""}`.trim();

    const existing = seasonMap.get(key);
    if (!existing) {
      seasonMap.set(key, {
        key,
        displayName: displayName(record),
        finalRank: record.finalRank,
        totalPoints: Number(record.totalPoints),
        teams: [record.teamName],
        userId: record.userId,
      });
      continue;
    }

    existing.teams.push(record.teamName);
    existing.teams.sort((left, right) => left.localeCompare(right));
    if (record.finalRank < existing.finalRank) {
      existing.finalRank = record.finalRank;
    }
    if (Number(record.totalPoints) > existing.totalPoints) {
      existing.totalPoints = Number(record.totalPoints);
    }
  }

  const seasonSummaries: SeasonSummary[] = Array.from(seasons.entries())
    .sort(([left], [right]) => right - left)
    .map(([season, seasonManagers]) => ({
      season,
      managers: Array.from(seasonManagers.values()).sort((left, right) => left.finalRank - right.finalRank),
    }));

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-emerald-500/20 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">League history</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Historical final standings</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
          This page uses the imported CSV to show each manager&apos;s final finish, points total, and roster for every completed season. New accounts are matched to historical records automatically when their first and last names match.
        </p>
      </section>

      {seasonSummaries.map((seasonSummary) => (
        <section key={seasonSummary.season} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Season</p>
              <h3 className="mt-1 text-2xl font-semibold text-white">{seasonSummary.season}</h3>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-white/5 text-left text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Rank</th>
                  <th className="px-4 py-3 font-semibold">Manager</th>
                  <th className="px-4 py-3 font-semibold">Points</th>
                  <th className="px-4 py-3 font-semibold">Roster</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-slate-950/40">
                {seasonSummary.managers.map((manager) => (
                  <tr key={manager.key} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold text-emerald-400">#{manager.finalRank}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{manager.displayName}</div>
                      {isAdmin ? (
                        manager.userId ? (
                          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Linked account</div>
                        ) : (
                          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-amber-400">Pending account match</div>
                        )
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{manager.totalPoints.toFixed(1)}</td>
                    <td className="px-4 py-3 text-slate-300">{manager.teams.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
