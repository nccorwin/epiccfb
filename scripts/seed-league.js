/**
 * Seeds the EPIC CFB league with the 10 real managers from the 2025 season.
 *
 * What this script does:
 *   1. Upserts all 10 manager accounts (creates if not found by email).
 *      - Placeholder emails are used for managers without known accounts.
 *      - Temp password: "EpicCFB2026!" (managers should reset after first login).
 *   2. Elevates Noah Corwin (nccorwin97@gmail.com) and Danny Chryst to ADMIN.
 *   3. Creates one canonical "EPIC CFB" league tied to the 2026 season.
 *   4. Adds all 10 managers to the league with 2025-standings draft positions.
 *
 * Usage: node scripts/seed-league.js
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

// 2025 season managers in order of final_rank (rank 10 = worst = picks 1st in draft)
// Add real email addresses here when known; placeholder emails will be used otherwise.
const MANAGERS = [
  { firstName: "Michael", lastName: "Carey",      email: "michael.carey@epiccfb.local",      finalRank: 10, role: "MANAGER" },
  { firstName: "Noah",    lastName: "Corwin",     email: "nccorwin97@gmail.com",             finalRank: 9,  role: "ADMIN"   }, // existing account
  { firstName: "Sally",   lastName: "Ehrmann",    email: "sally.ehrmann@epiccfb.local",      finalRank: 8,  role: "MANAGER" },
  { firstName: "Megan",   lastName: "Corwin",     email: "megan.corwin@epiccfb.local",       finalRank: 7,  role: "MANAGER" },
  { firstName: "Michael", lastName: "Miller",     email: "michael.miller@epiccfb.local",     finalRank: 6,  role: "MANAGER" },
  { firstName: "Nicky",   lastName: "Abbs",       email: "nicky.abbs@epiccfb.local",         finalRank: 5,  role: "MANAGER" },
  { firstName: "Maddie",  lastName: "Negaard",    email: "maddie.negaard@epiccfb.local",     finalRank: 4,  role: "MANAGER" },
  { firstName: "Danny",   lastName: "Chryst",     email: "danny.chryst@epiccfb.local",       finalRank: 3,  role: "ADMIN"   },
  { firstName: "Tom",     lastName: "Stamatakos", email: "tom.stamatakos@epiccfb.local",     finalRank: 2,  role: "MANAGER" },
  { firstName: "Joe",     lastName: "Moeller",    email: "joe.moeller@epiccfb.local",        finalRank: 1,  role: "MANAGER" },
];

const LEAGUE_NAME = "EPIC CFB";
const DRAFT_YEAR = 2026; // the upcoming season being drafted
const TEMP_PASSWORD = "EpicCFB2026!";

const ROSTER_REQUIREMENTS = [
  { slot: "BIG_TEN",      count: 1 },
  { slot: "BIG_TWELVE",   count: 1 },
  { slot: "SEC",          count: 1 },
  { slot: "ACC",          count: 1 },
  { slot: "GROUP_OF_FIVE",count: 2 },
  { slot: "FCS",          count: 2 },
  { slot: "WILDCARD",     count: 2 },
];

async function main() {
  console.log("=== EPIC CFB League Seeder ===\n");

  // ── 1. Hash temp password ────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  console.log(`Temp password hashed.`);

  // ── 2. Upsert manager accounts ───────────────────────────────────────────
  console.log("\nUpserting manager accounts...");
  const userMap = {}; // email -> User

  // Derive draft order: sort by finalRank descending (worst finish picks first)
  const sortedByDraftOrder = [...MANAGERS].sort((a, b) => b.finalRank - a.finalRank);

  for (const manager of MANAGERS) {
    const existing = await prisma.user.findUnique({ where: { email: manager.email } });

    let user;
    if (existing) {
      // Update role and names if needed, but don't overwrite passwordHash for real accounts
      user = await prisma.user.update({
        where: { email: manager.email },
        data: {
          firstName: existing.firstName ?? manager.firstName,
          lastName: existing.lastName ?? manager.lastName,
          name: existing.name ?? `${manager.firstName} ${manager.lastName}`,
          role: manager.role,
          // Only set password for placeholder accounts that don't have one yet
          ...(existing.passwordHash == null ? { passwordHash, emailVerified: true } : {}),
        },
      });
      console.log(`  ✓ Updated:  ${manager.firstName} ${manager.lastName} (${manager.email})`);
    } else {
      user = await prisma.user.create({
        data: {
          email: manager.email,
          firstName: manager.firstName,
          lastName: manager.lastName,
          name: `${manager.firstName} ${manager.lastName}`,
          passwordHash,
          emailVerified: true,
          role: manager.role,
        },
      });
      console.log(`  ✓ Created:  ${manager.firstName} ${manager.lastName} (${manager.email})`);
    }

    userMap[manager.email] = user;
  }

  // ── 3. Find or create 2026 Season ───────────────────────────────────────
  console.log(`\nFinding ${DRAFT_YEAR} season...`);
  let season = await prisma.season.findFirst({ where: { year: DRAFT_YEAR } });
  if (!season) {
    season = await prisma.season.create({
      data: {
        year: DRAFT_YEAR,
        startDate: new Date(`${DRAFT_YEAR}-08-01T00:00:00.000Z`),
        endDate: new Date(`${DRAFT_YEAR + 1}-01-15T00:00:00.000Z`),
      },
    });
    console.log(`  Created ${DRAFT_YEAR} season.`);
  } else {
    console.log(`  Found ${DRAFT_YEAR} season (id: ${season.id}).`);
  }

  // ── 4. Find or create the canonical EPIC CFB league ─────────────────────
  console.log(`\nLooking for existing "${LEAGUE_NAME}" league for ${DRAFT_YEAR}...`);
  let league = await prisma.league.findFirst({
    where: { name: LEAGUE_NAME, seasonId: season.id },
  });

  if (league) {
    console.log(`  Found existing league: ${league.id}`);
  } else {
    // Check if there's any 2026 league we can rename/adopt
    const existingLeague = await prisma.league.findFirst({
      where: { seasonId: season.id },
      orderBy: { createdAt: "asc" },
    });

    if (existingLeague) {
      league = await prisma.league.update({
        where: { id: existingLeague.id },
        data: {
          name: LEAGUE_NAME,
          settings: {
            draftType: "snake",
            draftStatus: "NOT_STARTED",
            rosterRequirements: ROSTER_REQUIREMENTS,
          },
        },
      });
      console.log(`  Renamed existing league to "${LEAGUE_NAME}" (id: ${league.id})`);
    } else {
      league = await prisma.league.create({
        data: {
          name: LEAGUE_NAME,
          seasonId: season.id,
          settings: {
            draftType: "snake",
            draftStatus: "NOT_STARTED",
            rosterRequirements: ROSTER_REQUIREMENTS,
          },
        },
      });
      console.log(`  Created new "${LEAGUE_NAME}" league (id: ${league.id})`);
    }
  }

  // ── 5. Remove old test league users, add all 10 real managers ───────────
  console.log("\nAdding managers to league...");

  // Remove any existing leagueUser entries for this league that aren't our 10 real managers
  const realUserIds = new Set(Object.values(userMap).map((u) => u.id));
  const existingMembers = await prisma.leagueUser.findMany({ where: { leagueId: league.id } });
  const staleMembers = existingMembers.filter((m) => !realUserIds.has(m.userId));
  if (staleMembers.length > 0) {
    await prisma.leagueUser.deleteMany({ where: { id: { in: staleMembers.map((m) => m.id) } } });
    console.log(`  Removed ${staleMembers.length} stale test user(s) from league.`);
  }

  for (const manager of sortedByDraftOrder) {
    const user = userMap[manager.email];
    const draftPosition = sortedByDraftOrder.findIndex((m) => m.email === manager.email) + 1;

    await prisma.leagueUser.upsert({
      where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
      update: { draftPosition },
      create: { leagueId: league.id, userId: user.id, draftPosition },
    });

    console.log(`  [${draftPosition}] ${manager.firstName} ${manager.lastName} (rank ${manager.finalRank})`);
  }

  // ── 6. Summary ───────────────────────────────────────────────────────────
  console.log("\n=== Done ===");
  console.log(`League:        ${LEAGUE_NAME} (id: ${league.id})`);
  console.log(`Season:        ${DRAFT_YEAR}`);
  console.log(`Managers:      ${MANAGERS.length}`);
  console.log(`Temp password: ${TEMP_PASSWORD}  ← managers should change this after first login`);
  console.log("\nPlaceholder emails (update via admin once real emails are known):");
  MANAGERS.filter((m) => m.email.endsWith("@epiccfb.local"))
    .forEach((m) => console.log(`  ${m.firstName} ${m.lastName}: ${m.email}`));
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
