export type DraftSlotType =
  | "BIG_TEN"
  | "BIG_TWELVE"
  | "SEC"
  | "ACC"
  | "GROUP_OF_FIVE"
  | "FCS"
  | "WILDCARD";

export type SlotTeamLike = {
  conference?: { name?: string | null } | null;
  isFcs?: boolean | null;
};

export type ExistingSlotSelection<TTeam extends SlotTeamLike = SlotTeamLike> = {
  slotType: DraftSlotType;
  team?: TTeam | null;
};

const SLOT_LIMITS: Record<DraftSlotType, number> = {
  BIG_TEN: 1,
  BIG_TWELVE: 1,
  SEC: 1,
  ACC: 1,
  GROUP_OF_FIVE: 2,
  FCS: 2,
  WILDCARD: 2,
};

export function normalizeConferenceName(conferenceName?: string | null) {
  return conferenceName?.trim().toLowerCase() ?? "";
}

export function isIndependentConference(conferenceName: string) {
  return ["independent", "independents", "notre dame", "uconn"].some((token) => conferenceName.includes(token));
}

function isGroupOfFiveConference(conferenceName: string) {
  return [
    "american athletic",
    "american",
    "conference usa",
    "c-usa",
    "mac",
    "mid-american",
    "mountain west",
    "mwc",
    "pac",
    "sun belt",
  ].some((name) => conferenceName.includes(name));
}

export function getBaseSlotTypeForTeam(team: SlotTeamLike): DraftSlotType {
  if (team.isFcs) return "FCS";

  const conferenceName = normalizeConferenceName(team.conference?.name);
  if (conferenceName.includes("big ten") || conferenceName.includes("big 10")) return "BIG_TEN";
  if (conferenceName.includes("big 12")) return "BIG_TWELVE";
  if (conferenceName.includes("sec")) return "SEC";
  if (conferenceName.includes("acc")) return "ACC";
  if (isGroupOfFiveConference(conferenceName)) return "GROUP_OF_FIVE";

  return "WILDCARD";
}

export function resolveSlotTypeForSelection<TTeam extends SlotTeamLike>(
  team: TTeam,
  existingSelections: ExistingSlotSelection<TTeam>[],
): DraftSlotType {
  const baseSlotType = getBaseSlotTypeForTeam(team);
  const conferenceName = normalizeConferenceName(team.conference?.name);

  if (baseSlotType === "WILDCARD" || isIndependentConference(conferenceName)) {
    return "WILDCARD";
  }

  const existingBaseSlotCount = existingSelections.filter((selection) => selection.slotType === baseSlotType).length;
  const baseSlotLimit = SLOT_LIMITS[baseSlotType];
  if (existingBaseSlotCount >= baseSlotLimit) {
    return "WILDCARD";
  }

  return baseSlotType;
}

export function getMaxSlotCount(slotType: DraftSlotType) {
  return SLOT_LIMITS[slotType];
}
