import { readFile } from "fs/promises";
import path from "path";
import { client, getGames, getLines, getCfpGames, type BettingGame, type Game, type SeasonType } from "cfbd";
import { canonicalizeTeamName } from "@/lib/team-name";

export const CFDB_BASE_URL = process.env.CFDB_BASE_URL ?? "https://api.collegefootballdata.com";

export const getCfdbApiKey = (): string => {
  const apiKey = process.env.CFDB_API_KEY;
  if (!apiKey) {
    throw new Error("CFDB_API_KEY environment variable is required for CFDB integration.");
  }
  return apiKey;
};

export function configureCfbdClient() {
  client.setConfig({
    headers: {
      Authorization: `Bearer ${getCfdbApiKey()}`,
    },
  });
}

export type CfdbLineResponse = {
  id: number;
  season: number;
  seasonType: string;
  week: number;
  startDate: string;
  homeTeamId: number;
  homeTeam: string;
  homeConference: string | null;
  homeClassification: string | null;
  homeScore: number | null;
  awayTeamId: number;
  awayTeam: string;
  awayConference: string | null;
  awayClassification: string | null;
  awayScore: number | null;
  lines: Array<{
    provider: string;
    spread: number | null;
    formattedSpread: string;
    spreadOpen: number | null;
    overUnder: number | null;
    overUnderOpen: number | null;
    homeMoneyline: number | null;
    awayMoneyline: number | null;
  }>;
};

export type CfdbGameResult = {
  id: number;
  season: number;
  week: number;
  seasonType: string;
  startDate: string;
  startTimeTBD: boolean;
  completed: boolean;
  neutralSite: boolean;
  conferenceGame: boolean;
  attendance: number | null;
  venueId: number | null;
  venue: string | null;
  homeId: number;
  homeTeam: string;
  homeConference: string | null;
  homeClassification: string | null;
  homePoints: number | null;
  awayId: number;
  awayTeam: string;
  awayConference: string | null;
  awayClassification: string | null;
  awayPoints: number | null;
  notes: string | null;
};

export type CfpMatchupInfo = {
  gameId: number | null;
  round: string;
  roundName: string;
  roundOrder: number;
  bowlName: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homePoints: number | null;
  awayPoints: number | null;
  completed: boolean;
  startDate: string | null;
  line: CfdbLineResponse | null;
};

type CachedScoreboardWeekData = {
  games: CfdbGameResult[];
  lines: CfdbLineResponse[];
};

type CachedScoreboardPostseasonData = {
  games: CfdbGameResult[];
  lines: CfdbLineResponse[];
  cfpGameIds: number[];
  cfpMatchupInfo: CfpMatchupInfo[];
};

type CachedScoreboardSeasonData = {
  season: number;
  updatedAt: string;
  weeks: Record<string, CachedScoreboardWeekData>;
  postseason: CachedScoreboardPostseasonData | null;
};

const SCOREBOARD_CACHE_DIR = path.join(process.cwd(), "data", "scoreboard");

function getScoreboardCachePath(season: number) {
  return path.join(SCOREBOARD_CACHE_DIR, `${season}.json`);
}

async function readScoreboardCache(season: number): Promise<CachedScoreboardSeasonData | null> {
  try {
    const raw = await readFile(getScoreboardCachePath(season), "utf8");
    return JSON.parse(raw) as CachedScoreboardSeasonData;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readCachedWeekData(season: number, week: number): Promise<CachedScoreboardWeekData | null> {
  const cache = await readScoreboardCache(season);
  const weekData = cache?.weeks?.[String(week)] ?? null;
  if (!weekData) {
    return null;
  }

  if (weekData.games.length === 0 && weekData.lines.length === 0) {
    return null;
  }

  return weekData;
}

async function readCachedPostseasonData(season: number): Promise<CachedScoreboardPostseasonData | null> {
  const cache = await readScoreboardCache(season);
  const postseason = cache?.postseason ?? null;
  if (!postseason) {
    return null;
  }

  if (
    postseason.games.length === 0 &&
    postseason.lines.length === 0 &&
    postseason.cfpGameIds.length === 0 &&
    postseason.cfpMatchupInfo.length === 0
  ) {
    return null;
  }

  return postseason;
}

function isFcsSecondRoundGame(game: Pick<CfdbGameResult, "notes">) {
  return Boolean(game.notes && game.notes.includes("FCS Championship - Second Round"));
}

function sortGamesByStartDate(games: CfdbGameResult[]) {
  return games.sort((left, right) => {
    const leftDate = left.startDate ? new Date(left.startDate).getTime() : 0;
    const rightDate = right.startDate ? new Date(right.startDate).getTime() : 0;
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }
    return left.id - right.id;
  });
}

async function getPriorFcsFirstRoundTeams(season: number, throughWeek: number) {
  const cache = await readScoreboardCache(season);
  const teams = new Set<string>();

  if (cache?.weeks) {
    for (let week = 0; week <= throughWeek; week += 1) {
      const weekData = cache.weeks[String(week)];
      if (!weekData || !Array.isArray(weekData.games)) {
        continue;
      }

      for (const game of weekData.games) {
        if (game.notes && game.notes.includes("FCS Championship - First Round")) {
          teams.add(canonicalizeTeamName(game.homeTeam));
          teams.add(canonicalizeTeamName(game.awayTeam));
        }
      }
    }

    return Array.from(teams);
  }

  return [];
}

function mapGameResult(game: Game): CfdbGameResult {
  return {
    id: game.id,
    season: game.season,
    week: game.week,
    seasonType: String(game.seasonType),
    startDate: game.startDate,
    startTimeTBD: game.startTimeTBD,
    completed: game.completed,
    neutralSite: game.neutralSite,
    conferenceGame: game.conferenceGame,
    attendance: game.attendance ?? null,
    venueId: game.venueId ?? null,
    venue: game.venue ?? null,
    homeId: game.homeId,
    homeTeam: game.homeTeam,
    homeConference: game.homeConference,
    homeClassification: game.homeClassification ?? null,
    homePoints: game.homePoints ?? null,
    awayId: game.awayId,
    awayTeam: game.awayTeam,
    awayConference: game.awayConference,
    awayClassification: game.awayClassification ?? null,
    awayPoints: game.awayPoints ?? null,
    notes: (game as Game & { notes?: string | null }).notes ?? null,
  };
}

function mapLineResponse(game: BettingGame): CfdbLineResponse {
  return {
    id: game.id,
    season: game.season,
    seasonType: String(game.seasonType),
    week: game.week,
    startDate: game.startDate,
    homeTeamId: game.homeTeamId,
    homeTeam: game.homeTeam,
    homeConference: game.homeConference,
    homeClassification: game.homeClassification ?? null,
    homeScore: game.homeScore ?? null,
    awayTeamId: game.awayTeamId,
    awayTeam: game.awayTeam,
    awayConference: game.awayConference,
    awayClassification: game.awayClassification ?? null,
    awayScore: game.awayScore ?? null,
    lines: (game.lines ?? []).map((line) => ({
      provider: line.provider,
      spread: line.spread ?? null,
      formattedSpread: line.formattedSpread,
      spreadOpen: line.spreadOpen ?? null,
      overUnder: line.overUnder ?? null,
      overUnderOpen: line.overUnderOpen ?? null,
      homeMoneyline: line.homeMoneyline ?? null,
      awayMoneyline: line.awayMoneyline ?? null,
    })),
  };
}

function normalizeGamesResponse(payload: unknown): Game[] {
  if (Array.isArray(payload)) return payload as Game[];
  const p = payload as { data?: Game[] };
  return p.data ?? [];
}

function normalizeLinesResponse(payload: unknown): BettingGame[] {
  if (Array.isArray(payload)) return payload as BettingGame[];
  const p = payload as { data?: BettingGame[] };
  return p.data ?? [];
}

async function fetchLinesForClassification(
  query: { year: number; week?: number; seasonType?: SeasonType },
  classification: "fbs" | "fcs",
): Promise<CfdbLineResponse[]> {
  try {
    const response = await getLines({ query: { ...query, classification } });
    return normalizeLinesResponse(response).map(mapLineResponse);
  } catch {
    return [];
  }
}

async function fetchGamesForClassification(
  query: { year: number; week?: number; seasonType?: SeasonType },
  classification: "fbs" | "fcs",
): Promise<CfdbGameResult[]> {
  try {
    const response = await getGames({ query: { ...query, classification } });
    return normalizeGamesResponse(response)
      .map(mapGameResult)
      .filter((game) => game.week === (query.week ?? game.week));
  } catch {
    return [];
  }
}

/** Fetches FBS + FCS lines and deduplicates by game id, preferring entries with actual spread data. */
async function getLinesWithFcs(query: { year: number; week?: number; seasonType?: SeasonType }): Promise<CfdbLineResponse[]> {
  configureCfbdClient();
  const [fbsLines, fcsLines] = await Promise.all([
    fetchLinesForClassification(query, "fbs"),
    fetchLinesForClassification(query, "fcs"),
  ]);

  const merged = new Map<number, CfdbLineResponse>();
  for (const line of fbsLines) {
    merged.set(line.id, line);
  }
  for (const line of fcsLines) {
    const existing = merged.get(line.id);
    if (!existing) {
      merged.set(line.id, line);
    } else if (!existing.lines.some((l) => l.spread != null) && line.lines.some((l) => l.spread != null)) {
      merged.set(line.id, line);
    }
  }
  return Array.from(merged.values());
}

async function getGamesWithFcs(query: { year: number; week?: number; seasonType?: SeasonType }): Promise<CfdbGameResult[]> {
  configureCfbdClient();
  const [fbsGames, fcsGames] = await Promise.all([
    fetchGamesForClassification(query, "fbs"),
    fetchGamesForClassification(query, "fcs"),
  ]);

  const merged = new Map<number, CfdbGameResult>();
  for (const game of fbsGames) {
    merged.set(game.id, game);
  }
  for (const game of fcsGames) {
    if (!merged.has(game.id)) {
      merged.set(game.id, game);
    }
  }

  return Array.from(merged.values());
}

async function getLinesWithFcsByQuery(query: { year: number; week?: number; seasonType?: SeasonType }): Promise<CfdbLineResponse[]> {
  const [fbsLines, fcsLines] = await Promise.all([
    fetchLinesForClassification(query, "fbs"),
    fetchLinesForClassification(query, "fcs"),
  ]);

  const merged = new Map<number, CfdbLineResponse>();
  for (const line of fbsLines) {
    merged.set(line.id, line);
  }
  for (const line of fcsLines) {
    const existing = merged.get(line.id);
    if (!existing) {
      merged.set(line.id, line);
    } else if (!existing.lines.some((l) => l.spread != null) && line.lines.some((l) => l.spread != null)) {
      merged.set(line.id, line);
    }
  }
  return Array.from(merged.values());
}

async function getWeekDataFromCfdb(season: number, week: number) {
  const [lines, games] = await Promise.all([
    getLineDataForWeek(season, week),
    getGameResultsForWeek(season, week),
  ]);
  return { lines, games };
}

export async function getLineDataForWeek(season: number, week: number): Promise<CfdbLineResponse[]> {
  const cached = await readCachedWeekData(season, week);
  if (cached) {
    return cached.lines;
  }

  const lines = await getLinesWithFcs({ year: season, week });
  return lines.filter((line) => line.week === week);
}

export async function getGameResultsForWeek(season: number, week: number): Promise<CfdbGameResult[]> {
  const cached = await readCachedWeekData(season, week);
  if (cached) {
    return cached.games;
  }

  return getGamesWithFcs({ year: season, week, seasonType: "regular" });
}

export async function getWeekData(season: number, week: number) {
  const cached = await readCachedWeekData(season, week);
  const priorFcsFirstRoundTeams = await getPriorFcsFirstRoundTeams(season, week - 1);
  if (cached) {
    return {
      ...cached,
      priorFcsFirstRoundTeams,
    };
  }

  const data = await getWeekDataFromCfdb(season, week);
  return {
    ...data,
    priorFcsFirstRoundTeams,
  };
}

export async function getPostseasonGames(season: number): Promise<CfdbGameResult[]> {
  const cached = await readCachedPostseasonData(season);
  if (cached) {
    return cached.games.filter((game) => !isFcsSecondRoundGame(game));
  }

  const postseasonWeeks = [16, 17, 18, 19, 20, 21];
  const results = await Promise.all([
    getGamesWithFcs({ year: season, seasonType: "postseason" }),
    ...postseasonWeeks.map((week) => getGamesWithFcs({ year: season, week, seasonType: "regular" })),
  ]);

  const merged = new Map<number, CfdbGameResult>();
  for (const games of results) {
    for (const game of games) {
      if (!merged.has(game.id)) {
        merged.set(game.id, game);
      }
    }
  }

  return Array.from(merged.values()).filter((game) => !isFcsSecondRoundGame(game));
}

export async function getPostseasonLines(season: number): Promise<CfdbLineResponse[]> {
  const cached = await readCachedPostseasonData(season);
  if (cached) {
    return cached.lines;
  }

  const postseasonWeeks = [16, 17, 18, 19, 20, 21];
  const results = await Promise.all([
    getLinesWithFcsByQuery({ year: season, seasonType: "postseason" as SeasonType }),
    ...postseasonWeeks.map((week) => getLinesWithFcsByQuery({ year: season, week, seasonType: "regular" })),
  ]);

  const merged = new Map<number, CfdbLineResponse>();
  for (const lines of results) {
    for (const line of lines) {
      const existing = merged.get(line.id);
      if (!existing) {
        merged.set(line.id, line);
      } else if (!existing.lines.some((entry) => entry.spread != null) && line.lines.some((entry) => entry.spread != null)) {
        merged.set(line.id, line);
      }
    }
  }

  return Array.from(merged.values());
}

export async function getCfpMatchupInfo(season: number): Promise<CfpMatchupInfo[]> {
  const cached = await readCachedPostseasonData(season);
  if (cached) {
    return cached.cfpMatchupInfo;
  }

  configureCfbdClient();
  const response = await getCfpGames({ query: { year: season } });
  const matchups = Array.isArray(response)
    ? response
    : ((response as { data?: unknown[] }).data ?? []);

  return matchups.map((m: unknown) => {
    const matchup = m as {
      round: string;
      roundName: string;
      roundOrder: number;
      bowlName?: string | null;
      game?: {
        id?: number;
        startDate?: string;
        completed?: boolean;
        homeTeam?: { school?: string };
        awayTeam?: { school?: string };
        homePoints?: number | null;
        awayPoints?: number | null;
      } | null;
    };
    return {
      gameId: matchup.game?.id ?? null,
      round: String(matchup.round),
      roundName: matchup.roundName,
      roundOrder: matchup.roundOrder,
      bowlName: matchup.bowlName ?? null,
      homeTeam: matchup.game?.homeTeam?.school ?? null,
      awayTeam: matchup.game?.awayTeam?.school ?? null,
      homePoints: matchup.game?.homePoints ?? null,
      awayPoints: matchup.game?.awayPoints ?? null,
      completed: matchup.game?.completed ?? false,
      startDate: matchup.game?.startDate ?? null,
      line: null,
    };
  });
}

export async function getPostseasonData(season: number) {
  const cached = await readCachedPostseasonData(season);
  const base = cached ?? await (async () => {
    const [games, lines, cfpMatchupInfo] = await Promise.all([
      getPostseasonGames(season),
      getPostseasonLines(season),
      getCfpMatchupInfo(season).catch(() => [] as CfpMatchupInfo[]),
    ]);

    const lineByGameId = new Map(lines.map((line) => [line.id, line] as const));
    const cfpGameIds = new Set(
      cfpMatchupInfo.map((m) => m.gameId).filter((id): id is number => id != null),
    );
    const enrichedCfpMatchupInfo = cfpMatchupInfo.map((matchup) => ({
      ...matchup,
      line: matchup.gameId != null ? lineByGameId.get(matchup.gameId) ?? null : null,
    }));

    return { games, lines, cfpGameIds: Array.from(cfpGameIds), cfpMatchupInfo: enrichedCfpMatchupInfo };
  })();

  const priorFcsFirstRoundTeams = await getPriorFcsFirstRoundTeams(season, 14);
  const postseasonGames = sortGamesByStartDate(base.games.filter((game) => !isFcsSecondRoundGame(game)));
  const postseasonGameIds = new Set(postseasonGames.map((game) => game.id));
  const postseasonLines = base.lines.filter((line) => postseasonGameIds.has(line.id));

  return {
    ...base,
    games: postseasonGames,
    lines: postseasonLines,
    priorFcsFirstRoundTeams,
  };
}