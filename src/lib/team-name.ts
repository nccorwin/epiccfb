const TEAM_NAME_ALIASES: Record<string, string> = {
  "app state": "appalachian state",
  "appalachian st": "appalachian state",
  "appalachian state": "appalachian state",
  cal: "california",
  california: "california",
  "jacksonville state": "jacksonville state",
  "jaksonville state": "jacksonville state",
  "louisiana state": "lsu",
  lsu: "lsu",
  "ole miss": "ole miss",
  mississippi: "ole miss",
  "miami oh": "miami ohio",
  "miami ohio": "miami ohio",
  "nc state": "nc state",
  "north carolina state": "nc state",
  "san jose state": "san jose state",
  sfa: "stephen f austin",
  "stephen f austin": "stephen f austin",
  "stephen f austin state": "stephen f austin",
  smu: "smu",
  "southern methodist": "smu",
  tcu: "tcu",
  "texas christian university": "tcu",
  usc: "usc",
  "university of southern california": "usc",
  utsa: "utsa",
  "university of texas san antonio": "utsa",
};

function normalizeWhitespace(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalizeTeamName(teamName: string) {
  const normalizedName = normalizeWhitespace(teamName);
  return TEAM_NAME_ALIASES[normalizedName] ?? normalizedName;
}
