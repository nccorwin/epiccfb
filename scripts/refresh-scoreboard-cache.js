const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { client, getGames, getLines, getCfpGames } = require("cfbd");

const ROOT_DIR = path.join(__dirname, "..");
const CACHE_DIR = path.join(ROOT_DIR, "data", "scoreboard");
const DEFAULT_SEASON = 2026;
const WEEK_DATE_RANGE_TEMPLATES = [
  { week: 0, startMonthDay: "08-25", endMonthDay: "08-31" },
  { week: 1, startMonthDay: "09-01", endMonthDay: "09-07" },
  { week: 2, startMonthDay: "09-08", endMonthDay: "09-14" },
  { week: 3, startMonthDay: "09-15", endMonthDay: "09-21" },
  { week: 4, startMonthDay: "09-22", endMonthDay: "09-28" },
  { week: 5, startMonthDay: "09-29", endMonthDay: "10-05" },
  { week: 6, startMonthDay: "10-06", endMonthDay: "10-12" },
  { week: 7, startMonthDay: "10-13", endMonthDay: "10-19" },
  { week: 8, startMonthDay: "10-20", endMonthDay: "10-26" },
  { week: 9, startMonthDay: "10-27", endMonthDay: "11-02" },
  { week: 10, startMonthDay: "11-03", endMonthDay: "11-09" },
  { week: 11, startMonthDay: "11-10", endMonthDay: "11-16" },
  { week: 12, startMonthDay: "11-17", endMonthDay: "11-23" },
  { week: 13, startMonthDay: "11-24", endMonthDay: "11-30" },
  { week: 14, startMonthDay: "12-01", endMonthDay: "12-07" },
  { week: 15, startMonthDay: "12-08", endMonthDay: "12-14" },
];

function buildWeekDateRanges(season) {
  return WEEK_DATE_RANGE_TEMPLATES.map((range) => ({
    week: range.week,
    start: `${season}-${range.startMonthDay}`,
    end: `${season}-${range.endMonthDay}`,
  }));
}

function loadEnvFile(filePath, { override = false } = {}) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }

    if (!override && process.env[key] != null) {
      continue;
    }

    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function loadEnvironment() {
  loadEnvFile(path.join(ROOT_DIR, ".env"));
  loadEnvFile(path.join(ROOT_DIR, ".env.production"));
  loadEnvFile(path.join(ROOT_DIR, ".env.local"), { override: true });
}

function getCfdbApiKey() {
  const apiKey = process.env.CFDB_API_KEY;
  if (!apiKey) {
    throw new Error("CFDB_API_KEY is required to refresh the scoreboard cache.");
  }
  return apiKey;
}

function configureCfbdClient() {
  client.setConfig({
    headers: {
      Authorization: `Bearer ${getCfdbApiKey()}`,
    },
  });
}

function normalizeGamesResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload && Array.isArray(payload.data) ? payload.data : [];
}

function normalizeLinesResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload && Array.isArray(payload.data) ? payload.data : [];
}

function mapGameResult(game) {
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
    notes: game.notes ?? null,
  };
}

function mapLineResponse(game) {
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

function fetchGamesForClassification(query, classification) {
  return getGames({ query: { ...query, classification } })
    .then(normalizeGamesResponse)
    .then((games) => games.map(mapGameResult).filter((game) => game.week === (query.week ?? game.week)));
}

function fetchLinesForClassification(query, classification) {
  return getLines({ query: { ...query, classification } })
    .then(normalizeLinesResponse)
    .then((lines) => lines.map(mapLineResponse));
}

async function getGamesWithFcs(query) {
  configureCfbdClient();
  const [fbsGames, fcsGames] = await Promise.all([
    fetchGamesForClassification(query, "fbs"),
    fetchGamesForClassification(query, "fcs"),
  ]);

  const merged = new Map();
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

async function getLinesWithFcs(query) {
  configureCfbdClient();
  const [fbsLines, fcsLines] = await Promise.all([
    fetchLinesForClassification(query, "fbs"),
    fetchLinesForClassification(query, "fcs"),
  ]);

  const merged = new Map();
  for (const line of fbsLines) {
    merged.set(line.id, line);
  }
  for (const line of fcsLines) {
    const existing = merged.get(line.id);
    if (!existing) {
      merged.set(line.id, line);
    } else if (!existing.lines.some((entry) => entry.spread != null) && line.lines.some((entry) => entry.spread != null)) {
      merged.set(line.id, line);
    }
  }

  return Array.from(merged.values());
}

async function getLineDataForWeek(season, week) {
  const lines = await getLinesWithFcs({ year: season, week });
  return lines.filter((line) => line.week === week);
}

async function getGameResultsForWeek(season, week) {
  return getGamesWithFcs({ year: season, week, seasonType: "regular" });
}

async function getWeekData(season, week) {
  const [lines, games] = await Promise.all([
    getLineDataForWeek(season, week),
    getGameResultsForWeek(season, week),
  ]);
  return { lines, games };
}

function getWeekForDate(dateString, weekDateRanges) {
  if (!dateString) {
    return null;
  }

  const datePart = dateString.slice(0, 10);
  const match = weekDateRanges.find((range) => datePart >= range.start && datePart <= range.end);
  return match ? match.week : null;
}

function partitionByWeek(items, weekDateRanges) {
  const partitions = {};
  for (let week = 0; week <= 15; week += 1) {
    partitions[String(week)] = [];
  }

  for (const item of items) {
    const week = getWeekForDate(item.startDate, weekDateRanges);
    if (week != null) {
      const bucket = partitions[String(week)];
      bucket.push(item);
    }
  }

  return partitions;
}

async function getPostseasonGames(season) {
  return getGamesWithFcs({ year: season, seasonType: "postseason" });
}

async function getPostseasonLines(season) {
  return getLinesWithFcs({ year: season, seasonType: "postseason" });
}

async function getSupplementalFcsSecondRoundData(season) {
  const [games, lines] = await Promise.all([
    getGamesWithFcs({ year: season, week: 15, seasonType: "regular" }),
    getLinesWithFcs({ year: season, week: 15, seasonType: "regular" }),
  ]);

  const secondRoundGames = games.filter((game) => game.notes && game.notes.includes("FCS Championship - Second Round"));
  if (secondRoundGames.length === 0) {
    return { games: [], lines: [] };
  }

  const ids = new Set(secondRoundGames.map((game) => game.id));
  return {
    games: secondRoundGames,
    lines: lines.filter((line) => ids.has(line.id)),
  };
}

async function getCfpMatchupInfo(season) {
  configureCfbdClient();
  const response = await getCfpGames({ query: { year: season } });
  const matchups = Array.isArray(response) ? response : (response.data ?? []);

  return matchups.map((matchup) => ({
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
  }));
}

async function getPostseasonData(season) {
  const [games, lines, cfpMatchupInfo] = await Promise.all([
    getPostseasonGames(season),
    getPostseasonLines(season),
    getCfpMatchupInfo(season).catch(() => []),
  ]);

  const supplemental = await getSupplementalFcsSecondRoundData(season);
  const mergedGames = new Map(games.map((game) => [game.id, game]));
  for (const game of supplemental.games) {
    mergedGames.set(game.id, game);
  }

  const mergedLines = new Map(lines.map((line) => [line.id, line]));
  for (const line of supplemental.lines) {
    mergedLines.set(line.id, line);
  }

  const sortedGames = Array.from(mergedGames.values()).sort((left, right) => {
    const leftDate = left.startDate ? new Date(left.startDate).getTime() : 0;
    const rightDate = right.startDate ? new Date(right.startDate).getTime() : 0;
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }
    return left.id - right.id;
  });

  const lineByGameId = new Map(Array.from(mergedLines.values()).map((line) => [line.id, line]));
  const cfpGameIds = Array.from(new Set(cfpMatchupInfo.map((matchup) => matchup.gameId).filter((id) => id != null)));
  const enrichedCfpMatchupInfo = cfpMatchupInfo.map((matchup) => ({
    ...matchup,
    line: matchup.gameId != null ? lineByGameId.get(matchup.gameId) ?? null : null,
  }));

  return { games: sortedGames, lines: Array.from(mergedLines.values()), cfpGameIds, cfpMatchupInfo: enrichedCfpMatchupInfo };
}

async function buildSeasonCache(season) {
  const weekDateRanges = buildWeekDateRanges(season);
  const [regularGames, regularLines, postseason] = await Promise.all([
    getGamesWithFcs({ year: season, seasonType: "regular" }),
    getLinesWithFcs({ year: season, seasonType: "regular" }),
    getPostseasonData(season),
  ]);

  const regularGamesByWeek = partitionByWeek(regularGames, weekDateRanges);
  const regularLinesByWeek = partitionByWeek(regularLines, weekDateRanges);
  const weeks = {};
  for (let week = 0; week <= 15; week += 1) {
    weeks[String(week)] = {
      games: regularGamesByWeek[String(week)] ?? [],
      lines: regularLinesByWeek[String(week)] ?? [],
    };
  }

  const hasAnyWeekData = Object.values(weeks).some((weekData) => weekData.games.length > 0 || weekData.lines.length > 0);
  const hasPostseasonData =
    postseason.games.length > 0 ||
    postseason.lines.length > 0 ||
    postseason.cfpGameIds.length > 0 ||
    postseason.cfpMatchupInfo.length > 0;

  if (!hasAnyWeekData && !hasPostseasonData) {
    throw new Error("CFDB returned no scoreboard data for the requested season; cache was not written.");
  }

  return {
    season,
    updatedAt: new Date().toISOString(),
    weeks,
    postseason,
  };
}

async function main() {
  loadEnvironment();
  const argSeason = Number(process.argv[2]);
  const envSeason = Number(process.env.SCOREBOARD_SEASON);
  const season = Number.isInteger(argSeason)
    ? argSeason
    : Number.isInteger(envSeason)
      ? envSeason
      : DEFAULT_SEASON;
  const seasonFile = path.join(CACHE_DIR, `${season}.json`);

  const cache = await buildSeasonCache(season);
  await fsp.mkdir(CACHE_DIR, { recursive: true });
  await fsp.writeFile(seasonFile, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

  console.log(`Wrote scoreboard cache for ${season} to ${path.relative(process.cwd(), seasonFile)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
