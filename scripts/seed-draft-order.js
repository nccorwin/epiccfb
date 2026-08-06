/**
 * Seeds draft positions for the 10 managers based on their 2025 final_rank
 * from league-history.csv. Worst finish (highest rank number) picks first.
 *
 * Usage: node scripts/seed-draft-order.js
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const prisma = new PrismaClient();

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""); // strip BOM
  const lines = raw.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i]]));
  });
}

async function main() {
  const csvPath = path.join(__dirname, "..", "league-history.csv");
  const rows = parseCsv(csvPath);

  // Extract unique managers from the 2025 season and map name → draft_position.
  // draft_position = (total managers + 1) - final_rank
  // i.e. rank 10 (last place) → picks 1st, rank 1 (champion) → picks 10th.
  const season2025 = rows.filter((r) => r.season === "2025");
  const uniqueManagers = new Map(); // "First Last" -> { firstName, lastName, finalRank }
  for (const row of season2025) {
    const key = `${row.first_name} ${row.last_name}`;
    if (!uniqueManagers.has(key)) {
      uniqueManagers.set(key, {
        firstName: row.first_name,
        lastName: row.last_name,
        finalRank: Number(row.final_rank),
      });
    }
  }

  const managerCount = uniqueManagers.size;
  console.log(`Found ${managerCount} managers in 2025 season from CSV.`);

  // Build draft position list: worst finish picks first
  const draftOrder = Array.from(uniqueManagers.values())
    .sort((a, b) => b.finalRank - a.finalRank) // descending rank = picks first
    .map((m, idx) => ({ ...m, draftPosition: idx + 1 }));

  console.log("\nDraft order derived from CSV:");
  draftOrder.forEach((m) => {
    console.log(`  [${m.draftPosition}] ${m.firstName} ${m.lastName} (2025 rank: ${m.finalRank})`);
  });

  // Find the active league
  const leagues = await prisma.league.findMany({ take: 1 });
  const league = leagues[0];
  if (!league) {
    console.error("\nNo league found in the database.");
    process.exit(1);
  }
  console.log(`\nSeeding draft order for league: ${league.name} (${league.id})`);

  const leagueUsers = await prisma.leagueUser.findMany({
    where: { leagueId: league.id },
    include: { user: true },
  });

  let matched = 0;
  const unmatched = [];

  for (const entry of draftOrder) {
    const lu = leagueUsers.find((lu) => {
      // Match on firstName+lastName (case-insensitive)
      const fn = (lu.user.firstName ?? "").toLowerCase();
      const ln = (lu.user.lastName ?? "").toLowerCase();
      if (fn === entry.firstName.toLowerCase() && ln === entry.lastName.toLowerCase()) return true;
      // Fallback: match on user.name containing full name
      const fullName = (lu.user.name ?? "").toLowerCase();
      return fullName === `${entry.firstName} ${entry.lastName}`.toLowerCase();
    });

    if (!lu) {
      unmatched.push(`${entry.firstName} ${entry.lastName}`);
      continue;
    }

    await prisma.leagueUser.update({
      where: { id: lu.id },
      data: { draftPosition: entry.draftPosition },
    });

    console.log(`  ✓ [${entry.draftPosition}] ${entry.firstName} ${entry.lastName} → userId ${lu.userId}`);
    matched++;
  }

  console.log(`\nDone. Matched and updated ${matched}/${draftOrder.length} managers.`);

  if (unmatched.length > 0) {
    console.warn("\nUnmatched managers (not found in league):", unmatched.join(", "));
    console.warn(
      "These managers need accounts with matching firstName/lastName (or name) fields.\n" +
      "Run this script again after all managers have signed up.",
    );
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());

