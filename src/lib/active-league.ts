import { CURRENT_SEASON } from "@/lib/current-season";
import { getSeasonRedraftMoves } from "@/lib/season-redraft";
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
  createdAt?: string | Date | null;
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

function normalizeManagerName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function applySeasonRedraftMoves(season: number, managerByUserId: Map<string, SeasonHistoryManager>) {
  const redraftMoves = getSeasonRedraftMoves(season);
  if (!redraftMoves.length) {
    return;
  }

  const managers = Array.from(managerByUserId.values());
  const managerByName = new Map<string, SeasonHistoryManager>();
  for (const manager of managers) {
    const fullName = [manager.firstName, manager.lastName].filter(Boolean).join(" ").trim();
    managerByName.set(normalizeManagerName(manager.displayName), manager);
    if (fullName) {
      managerByName.set(normalizeManagerName(fullName), manager);
    }
  }

  for (const manager of managers) {
    const initialTeams = manager.teams.slice();
    const activeTeams = manager.teams.slice();
    const timeline = new Map<
      string,
      { teamName: string; acquiredWeek: number | null; droppedAfterWeek: number | null }
    >();
    for (const teamName of initialTeams) {
      timeline.set(teamName.toLowerCase(), {
        teamName,
        acquiredWeek: null,
        droppedAfterWeek: null,
      });
    }

    const managerMoves = redraftMoves
      .filter((move) => managerByName.get(normalizeManagerName(move.managerName))?.key === manager.key)
      .sort((left, right) => left.effectiveWeek - right.effectiveWeek);

    for (const move of managerMoves) {
      const dropIndex = activeTeams.findIndex((team) => team.toLowerCase() === move.dropTeam.toLowerCase());
      if (dropIndex >= 0) {
        activeTeams.splice(dropIndex, 1);
      }

      const existingDrop = timeline.get(move.dropTeam.toLowerCase());
      if (existingDrop) {
        existingDrop.droppedAfterWeek = move.effectiveWeek - 1;
      } else {
        timeline.set(move.dropTeam.toLowerCase(), {
          teamName: move.dropTeam,
          acquiredWeek: null,
          droppedAfterWeek: move.effectiveWeek - 1,
        });
      }

      if (!activeTeams.some((team) => team.toLowerCase() === move.pickupTeam.toLowerCase())) {
        activeTeams.push(move.pickupTeam);
      }

      const existingPickup = timeline.get(move.pickupTeam.toLowerCase());
      if (existingPickup) {
        existingPickup.acquiredWeek = existingPickup.acquiredWeek ?? move.effectiveWeek;
      } else {
        timeline.set(move.pickupTeam.toLowerCase(), {
          teamName: move.pickupTeam,
          acquiredWeek: move.effectiveWeek,
          droppedAfterWeek: null,
        });
      }
    }

    manager.initialTeams = initialTeams;
    manager.rosterMoves = managerMoves.map((move) => ({
      dropTeam: move.dropTeam,
      pickupTeam: move.pickupTeam,
      effectiveWeek: move.effectiveWeek,
    }));
    manager.teamTimeline = Array.from(timeline.values());
    manager.teams = activeTeams;
  }
}

function sortLeaguesByRecency<T extends { season?: { year: number } | null; createdAt?: string | Date | null }>(
  left: T,
  right: T,
) {
  const rightSeason = right.season?.year ?? -1;
  const leftSeason = left.season?.year ?? -1;
  if (rightSeason !== leftSeason) {
    return rightSeason - leftSeason;
  }
  const rightCreatedAt = right.createdAt instanceof Date
    ? right.createdAt.getTime()
    : right.createdAt
      ? new Date(right.createdAt).getTime()
      : 0;
  const leftCreatedAt = left.createdAt instanceof Date
    ? left.createdAt.getTime()
    : left.createdAt
      ? new Date(left.createdAt).getTime()
      : 0;
  return rightCreatedAt - leftCreatedAt;
}

export function selectActiveLeague<T extends { season?: { year: number } | null; createdAt?: string | Date | null }>(
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

  applySeasonRedraftMoves(season, managerByUserId);

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
