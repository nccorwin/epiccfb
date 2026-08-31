import { CURRENT_SEASON } from "@/lib/current-season";
import type { SeasonHistoryManager } from "@/lib/season-summary";

type LeagueUserSummary = {
  draftPosition?: number | null;
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
  };
};

type LeagueSummary = {
  id: string;
  createdAt?: string | null;
  season?: { year: number } | null;
  leagueUsers: LeagueUserSummary[];
};

type DraftPickSummary = {
  user?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
  } | null;
  team?: {
    name: string;
  } | null;
};

function getManagerDisplayName(user: LeagueUserSummary["user"]) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.name || user.email;
}

function sortLeaguesByRecency<T extends { season?: { year: number } | null; createdAt?: string | null }>(
  left: T,
  right: T,
) {
  const rightSeason = right.season?.year ?? -1;
  const leftSeason = left.season?.year ?? -1;
  if (rightSeason !== leftSeason) {
    return rightSeason - leftSeason;
  }
  const rightCreatedAt = right.createdAt ? new Date(right.createdAt).getTime() : 0;
  const leftCreatedAt = left.createdAt ? new Date(left.createdAt).getTime() : 0;
  return rightCreatedAt - leftCreatedAt;
}

export function selectActiveLeague<T extends { season?: { year: number } | null; createdAt?: string | null }>(
  leagues: T[],
): T | null {
  if (!Array.isArray(leagues) || leagues.length === 0) {
    return null;
  }

  const exactSeasonMatch = leagues
    .filter((league) => league.season?.year === CURRENT_SEASON)
    .sort(sortLeaguesByRecency)[0];
  if (exactSeasonMatch) {
    return exactSeasonMatch;
  }

  return [...leagues].sort(sortLeaguesByRecency)[0] ?? null;
}

export function buildSeasonManagers(
  season: number,
  leagueUsers: LeagueUserSummary[],
  picks: DraftPickSummary[],
): SeasonHistoryManager[] {
  const managerByUserId = new Map<string, SeasonHistoryManager>();
  const sortedLeagueUsers = [...leagueUsers].sort((left, right) => {
    const leftPosition = left.draftPosition ?? Number.MAX_SAFE_INTEGER;
    const rightPosition = right.draftPosition ?? Number.MAX_SAFE_INTEGER;
    return leftPosition - rightPosition;
  });

  sortedLeagueUsers.forEach((entry, index) => {
    managerByUserId.set(entry.user.id, {
      key: entry.user.id,
      season,
      finalRank: entry.draftPosition ?? index + 1,
      totalPoints: 0,
      firstName: entry.user.firstName ?? null,
      lastName: entry.user.lastName ?? null,
      userId: entry.user.id,
      email: entry.user.email,
      displayName: getManagerDisplayName(entry.user),
      teams: [],
    });
  });

  for (const pick of picks) {
    if (!pick.user?.id || !pick.team?.name) {
      continue;
    }
    const existingManager = managerByUserId.get(pick.user.id);
    if (!existingManager) {
      managerByUserId.set(pick.user.id, {
        key: pick.user.id,
        season,
        finalRank: managerByUserId.size + 1,
        totalPoints: 0,
        firstName: pick.user.firstName ?? null,
        lastName: pick.user.lastName ?? null,
        userId: pick.user.id,
        email: pick.user.email,
        displayName: getManagerDisplayName(pick.user),
        teams: [pick.team.name],
      });
      continue;
    }
    if (!existingManager.teams.includes(pick.team.name)) {
      existingManager.teams.push(pick.team.name);
    }
  }

  return Array.from(managerByUserId.values()).sort((left, right) => {
    if (left.finalRank !== right.finalRank) {
      return left.finalRank - right.finalRank;
    }
    return left.displayName.localeCompare(right.displayName);
  });
}

export async function fetchCurrentSeasonLeagueContext(): Promise<{
  season: number;
  leagueId: string;
  managers: SeasonHistoryManager[];
}> {
  const leagueResponse = await fetch("/api/leagues");
  if (!leagueResponse.ok) {
    throw new Error("Unable to load leagues.");
  }

  const leaguesPayload = (await leagueResponse.json()) as LeagueSummary[];
  const activeLeague = selectActiveLeague(Array.isArray(leaguesPayload) ? leaguesPayload : []);
  if (!activeLeague) {
    throw new Error("No active league was found.");
  }

  const picksResponse = await fetch(`/api/leagues/${activeLeague.id}/picks`);
  if (!picksResponse.ok) {
    throw new Error("Unable to load league picks.");
  }
  const picksPayload = (await picksResponse.json()) as DraftPickSummary[];

  const season = activeLeague.season?.year ?? CURRENT_SEASON;
  const managers = buildSeasonManagers(
    season,
    Array.isArray(activeLeague.leagueUsers) ? activeLeague.leagueUsers : [],
    Array.isArray(picksPayload) ? picksPayload : [],
  );

  return {
    season,
    leagueId: activeLeague.id,
    managers,
  };
}
