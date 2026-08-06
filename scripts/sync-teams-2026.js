/**
 * Syncs Team + Conference tables from college-teams-2026.csv.
 *
 * Usage:
 *   node scripts/sync-teams-2026.js
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient, ConferenceGroupType } = require("@prisma/client");

const prisma = new PrismaClient();

function normalizeConferenceName(raw) {
  const name = String(raw ?? "").trim();
  if (!name) return "Independent";

  if (/^southeastern$/i.test(name)) return "SEC";
  if (/^atlantic coast$/i.test(name)) return "ACC";
  if (/^big[\s-]?ten$/i.test(name) || /^big[\s-]?10$/i.test(name)) return "Big Ten";
  if (/^big[\s-]?12$/i.test(name)) return "Big 12";
  if (/^mid[\s-]?american$/i.test(name)) return "MAC";
  if (/^american athletic$/i.test(name)) return "American Athletic";
  if (/^conference usa$/i.test(name)) return "Conference USA";
  if (/^mountain west$/i.test(name)) return "Mountain West";
  if (/^sun belt$/i.test(name)) return "Sun Belt";
  if (/^pac[\s-]?12$/i.test(name)) return "Pac-12";
  if (/^independents?$/i.test(name)) return "Independent";
  return name;
}

function conferenceShortName(name) {
  if (name === "Big Ten") return "BIG TEN";
  if (name === "Big 12") return "BIG 12";
  if (name === "SEC") return "SEC";
  if (name === "ACC") return "ACC";
  if (name === "MAC") return "MAC";
  if (name === "Mountain West") return "MW";
  if (name === "Pac-12") return "PAC-12";
  if (name === "Sun Belt") return "SBC";
  if (name === "American Athletic") return "AAC";
  if (name === "Conference USA") return "CUSA";
  if (name === "Independent") return "IND";
  if (name === "FCS") return "FCS";
  return name.slice(0, 16).toUpperCase();
}

function groupTypeFor(conferenceName, isFcs) {
  if (isFcs || conferenceName === "FCS") return ConferenceGroupType.FCS;
  if (conferenceName === "Big Ten" || conferenceName === "Big 12" || conferenceName === "SEC" || conferenceName === "ACC") {
    return ConferenceGroupType.POWER;
  }
  if (conferenceName === "Independent") return ConferenceGroupType.OTHER;
  return ConferenceGroupType.GROUP_OF_FIVE;
}

function toSlug(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseTeamsCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // The provided CSV stores each row as a single quoted string:
  // "Team,Division,Conference"
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/^"|"$/g, "");
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const teamName = parts[0]?.trim();
    const division = parts[1]?.trim().toUpperCase();
    const conference = parts.slice(2).join(",").trim();
    if (!teamName || (division !== "FBS" && division !== "FCS")) continue;
    rows.push({
      teamName,
      division,
      conference: normalizeConferenceName(conference),
    });
  }
  return rows;
}

async function main() {
  const csvPath = path.join(__dirname, "..", "college-teams-2026.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Missing CSV: ${csvPath}`);
  }

  const rows = parseTeamsCsv(csvPath);
  if (rows.length === 0) {
    throw new Error("No valid team rows found in college-teams-2026.csv");
  }

  const conferenceNames = Array.from(new Set(rows.map((r) => (r.division === "FCS" ? "FCS" : r.conference))));
  const existingConferences = await prisma.conference.findMany();
  const conferenceByName = new Map(existingConferences.map((c) => [c.name, c]));

  for (const conferenceName of conferenceNames) {
    if (!conferenceByName.has(conferenceName)) {
      const created = await prisma.conference.create({
        data: {
          name: conferenceName,
          shortName: conferenceShortName(conferenceName),
          groupType: groupTypeFor(conferenceName, conferenceName === "FCS"),
        },
      });
      conferenceByName.set(conferenceName, created);
    } else {
      const current = conferenceByName.get(conferenceName);
      const nextGroupType = groupTypeFor(conferenceName, conferenceName === "FCS");
      if (current.shortName !== conferenceShortName(conferenceName) || current.groupType !== nextGroupType) {
        const updated = await prisma.conference.update({
          where: { id: current.id },
          data: {
            shortName: conferenceShortName(conferenceName),
            groupType: nextGroupType,
          },
        });
        conferenceByName.set(conferenceName, updated);
      }
    }
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const isFcs = row.division === "FCS";
    const conferenceName = isFcs ? "FCS" : row.conference;
    const conference = conferenceByName.get(conferenceName);
    if (!conference) continue;

    const existing = await prisma.team.findFirst({
      where: { name: row.teamName },
    });

    if (existing) {
      await prisma.team.update({
        where: { id: existing.id },
        data: {
          name: row.teamName,
          shortName: existing.shortName ?? row.teamName.slice(0, 24),
          schoolSlug: toSlug(row.teamName),
          conferenceId: conference.id,
          isFcs,
        },
      });
      updated += 1;
    } else {
      await prisma.team.create({
        data: {
          name: row.teamName,
          shortName: row.teamName.slice(0, 24),
          schoolSlug: toSlug(row.teamName),
          conferenceId: conference.id,
          isFcs,
        },
      });
      created += 1;
    }
  }

  const total = await prisma.team.count();
  const fbsCount = await prisma.team.count({ where: { isFcs: false } });
  const fcsCount = await prisma.team.count({ where: { isFcs: true } });
  const boise = await prisma.team.findFirst({ where: { name: "Boise State" }, include: { conference: true } });
  const ndsu = await prisma.team.findFirst({ where: { name: "North Dakota State" }, include: { conference: true } });

  console.log(`Imported rows: ${rows.length}`);
  console.log(`Teams created: ${created}`);
  console.log(`Teams updated: ${updated}`);
  console.log(`Total teams in DB: ${total} (${fbsCount} FBS, ${fcsCount} FCS)`);
  if (boise) console.log(`Boise State conference: ${boise.conference?.name ?? "N/A"}`);
  if (ndsu) console.log(`North Dakota State conference: ${ndsu.conference?.name ?? "N/A"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
