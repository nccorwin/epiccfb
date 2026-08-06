const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const csvPath = path.join(__dirname, "..", "league-history.csv");

function parseCsv(content) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentValue += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentValue);
      if (currentRow.some((value) => value.trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    if (currentRow.some((value) => value.trim() !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

async function main() {
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(csvContent);
  if (!rows.length) {
    throw new Error("No rows were found in league-history.csv");
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const indexOf = (name) => headers.indexOf(name);

  await prisma.leagueHistoryEntry.deleteMany({});

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || row.every((value) => value.trim() === "")) {
      continue;
    }

    const season = Number(row[indexOf("season")].trim());
    const firstName = row[indexOf("first_name")].trim();
    const lastName = row[indexOf("last_name")].trim();
    const finalRank = Number(row[indexOf("final_rank")].trim());
    const totalPoints = Number(row[indexOf("total_points")].trim());
    const teamName = row[indexOf("team")].trim();

    const matchedUser = firstName && lastName
      ? await prisma.user.findFirst({
          where: {
            firstName: { equals: firstName, mode: "insensitive" },
            lastName: { equals: lastName, mode: "insensitive" },
          },
          select: { id: true },
        })
      : null;

    await prisma.leagueHistoryEntry.create({
      data: {
        season,
        firstName,
        lastName,
        userId: matchedUser?.id ?? null,
        finalRank,
        totalPoints,
        teamName,
      },
    });
  }

  console.log(`Imported ${rows.length - 1} history rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
