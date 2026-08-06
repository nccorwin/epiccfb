const { PrismaClient, ConferenceGroupType } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const conferences = [
    { name: "Big Ten", shortName: "BIG TEN", groupType: ConferenceGroupType.POWER },
    { name: "Big 12", shortName: "BIG 12", groupType: ConferenceGroupType.POWER },
    { name: "SEC", shortName: "SEC", groupType: ConferenceGroupType.POWER },
    { name: "ACC", shortName: "ACC", groupType: ConferenceGroupType.POWER },
    { name: "MAC", shortName: "MAC", groupType: ConferenceGroupType.GROUP_OF_FIVE },
    { name: "Mountain West", shortName: "Mountain West", groupType: ConferenceGroupType.GROUP_OF_FIVE },
    { name: "Pac-12", shortName: "Pac-12", groupType: ConferenceGroupType.GROUP_OF_FIVE },
    { name: "Sun Belt", shortName: "Sun Belt", groupType: ConferenceGroupType.GROUP_OF_FIVE },
    { name: "FCS", shortName: "FCS", groupType: ConferenceGroupType.FCS },
    { name: "Independent", shortName: "IND", groupType: ConferenceGroupType.OTHER },
  ];

  await prisma.conference.createMany({ data: conferences, skipDuplicates: true });

  const conferenceMap = new Map(
    (await prisma.conference.findMany()).map((conference) => [conference.shortName, conference.id]),
  );

  const teams = [
    { name: "Ohio State", shortName: "OSU", schoolSlug: "ohio-state", conferenceId: conferenceMap.get("BIG TEN"), isFcs: false },
    { name: "Michigan", shortName: "MICH", schoolSlug: "michigan", conferenceId: conferenceMap.get("BIG TEN"), isFcs: false },
    { name: "Texas", shortName: "TEX", schoolSlug: "texas", conferenceId: conferenceMap.get("BIG 12"), isFcs: false },
    { name: "Oklahoma State", shortName: "OKST", schoolSlug: "oklahoma-state", conferenceId: conferenceMap.get("BIG 12"), isFcs: false },
    { name: "Georgia", shortName: "UGA", schoolSlug: "georgia", conferenceId: conferenceMap.get("SEC"), isFcs: false },
    { name: "Alabama", shortName: "ALA", schoolSlug: "alabama", conferenceId: conferenceMap.get("SEC"), isFcs: false },
    { name: "Florida State", shortName: "FSU", schoolSlug: "florida-state", conferenceId: conferenceMap.get("ACC"), isFcs: false },
    { name: "Clemson", shortName: "CLEM", schoolSlug: "clemson", conferenceId: conferenceMap.get("ACC"), isFcs: false },
    { name: "Toledo", shortName: "TOL", schoolSlug: "toledo", conferenceId: conferenceMap.get("MAC"), isFcs: false },
    { name: "Boise State", shortName: "BOISE", schoolSlug: "boise-state", conferenceId: conferenceMap.get("Mountain West"), isFcs: false },
    { name: "Washington State", shortName: "WSU", schoolSlug: "washington-state", conferenceId: conferenceMap.get("Pac-12"), isFcs: false },
    { name: "Appalachian State", shortName: "APP", schoolSlug: "appalachian-state", conferenceId: conferenceMap.get("Sun Belt"), isFcs: false },
    { name: "Notre Dame", shortName: "ND", schoolSlug: "notre-dame", conferenceId: conferenceMap.get("IND"), isFcs: false },
    { name: "North Dakota State", shortName: "NDSU", schoolSlug: "north-dakota-state", conferenceId: conferenceMap.get("FCS"), isFcs: true },
    { name: "Montana State", shortName: "MSU", schoolSlug: "montana-state", conferenceId: conferenceMap.get("FCS"), isFcs: true },
  ];

  await prisma.team.createMany({ data: teams, skipDuplicates: true });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
