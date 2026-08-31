const TEAM_NAME_ALIASES: Record<string, string> = {
  "app state": "appalachian state",
  "appalachian st": "appalachian state",
  "appalachian state": "appalachian state",
  "ball st": "ball state",
  "ball state": "ball state",
  "boise st": "boise state",
  "boise state": "boise state",
  cal: "california",
  california: "california",
  "fresno st": "fresno state",
  "fresno state": "fresno state",
  "illinois st": "illinois state",
  "illinois state": "illinois state",
  "jacksonville state": "jacksonville state",
  "jaksonville state": "jacksonville state",
  "kansas st": "kansas state",
  "kansas state": "kansas state",
  "louisiana state": "lsu",
  lsu: "lsu",
  "montana st": "montana state",
  "montana state": "montana state",
  "missouri st": "missouri state",
  "missouri state": "missouri state",
  "ole miss": "ole miss",
  mississippi: "ole miss",
  "miami oh": "miami ohio",
  "miami ohio": "miami ohio",
  "nc state": "nc state",
  "north dakota st": "north dakota state",
  "north dakota state": "north dakota state",
  "north carolina state": "nc state",
  "oklahoma st": "oklahoma state",
  "oklahoma state": "oklahoma state",
  "oregon st": "oregon state",
  "oregon state": "oregon state",
  "san jose state": "san jose state",
  sfa: "stephen f austin",
  "south dakota st": "south dakota state",
  "south dakota state": "south dakota state",
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
  "washington st": "washington state",
  "washington state": "washington state",
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
