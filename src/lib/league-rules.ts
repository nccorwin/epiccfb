import { RosterSlotType } from "@prisma/client";

export const REQUIRED_ROSTER_SLOTS: Array<{ slotType: RosterSlotType; count: number }> = [
  { slotType: RosterSlotType.BIG_TEN, count: 1 },
  { slotType: RosterSlotType.BIG_TWELVE, count: 1 },
  { slotType: RosterSlotType.SEC, count: 1 },
  { slotType: RosterSlotType.ACC, count: 1 },
  { slotType: RosterSlotType.GROUP_OF_FIVE, count: 2 },
  { slotType: RosterSlotType.FCS, count: 2 },
  { slotType: RosterSlotType.WILDCARD, count: 2 },
];

export type TeamLike = {
  conference?: { name?: string | null } | null;
  isFcs?: boolean | null;
};

export type ExistingRosterSelection = {
  slotType: RosterSlotType;
  team?: TeamLike | null;
};

function normalizeConferenceName(conferenceName?: string | null) {
  return conferenceName?.trim().toLowerCase() ?? "";
}

function isIndependentConference(conferenceName: string) {
  return ["independent", "independents", "notre dame", "uconn"].some((token) => conferenceName.includes(token));
}

export function getBaseRosterSlotTypeForTeam(team: TeamLike): RosterSlotType | null {
  if (team.isFcs) return RosterSlotType.FCS;

  const conferenceName = normalizeConferenceName(team.conference?.name);
  if (conferenceName.includes("big ten") || conferenceName.includes("big 10")) return RosterSlotType.BIG_TEN;
  if (conferenceName.includes("big 12")) return RosterSlotType.BIG_TWELVE;
  if (conferenceName.includes("sec")) return RosterSlotType.SEC;
  if (conferenceName.includes("acc")) return RosterSlotType.ACC;
  if (
    [
      "american athletic",
      "conference usa",
      "mac",
      "mountain west",
      "pac",
      "sun belt",
    ].some((name) => conferenceName.includes(name))
  ) {
    return RosterSlotType.GROUP_OF_FIVE;
  }

  return RosterSlotType.WILDCARD;
}

export function resolveRosterSlotTypeForSelection(team: TeamLike, existingSelections: ExistingRosterSelection[]) {
  const baseSlotType = getBaseRosterSlotTypeForTeam(team);
  if (!baseSlotType) return null;

  const conferenceName = normalizeConferenceName(team.conference?.name);
  const existingConferenceNames = existingSelections
    .map((selection) => normalizeConferenceName(selection.team?.conference?.name))
    .filter(Boolean);

  if (baseSlotType === RosterSlotType.FCS) {
    const existingFcsSlots = existingSelections.filter((selection) => selection.slotType === RosterSlotType.FCS).length;
    if (existingFcsSlots >= 2) {
      return RosterSlotType.WILDCARD;
    }
    return baseSlotType;
  }

  if (baseSlotType === RosterSlotType.WILDCARD || isIndependentConference(conferenceName)) {
    return RosterSlotType.WILDCARD;
  }

  if (existingConferenceNames.includes(conferenceName)) {
    return RosterSlotType.WILDCARD;
  }

  return baseSlotType;
}

export function getDraftPickNumber(round: number, pickWithinRound: number, userCount: number) {
  if (pickWithinRound <= 0 || pickWithinRound > userCount) {
    throw new Error("pickWithinRound must fall within the number of users.");
  }

  const baseIndex = round - 1;
  const order = baseIndex % 2 === 0
    ? Array.from({ length: userCount }, (_, index) => index + 1)
    : Array.from({ length: userCount }, (_, index) => userCount - index);

  return order[pickWithinRound - 1];
}

export function getPickOrderForRound(round: number, userCount: number) {
  if (round < 1 || userCount < 1) {
    throw new Error("round and userCount must be positive.");
  }

  return round % 2 === 1
    ? Array.from({ length: userCount }, (_, index) => index + 1)
    : Array.from({ length: userCount }, (_, index) => userCount - index);
}

export function validateRosterSelection(team: TeamLike, existingSelections: ExistingRosterSelection[]) {
  const slotType = resolveRosterSlotTypeForSelection(team, existingSelections);
  if (!slotType) return false;

  const currentCount = existingSelections.filter((selection) => selection.slotType === slotType).length;
  const maxCount = REQUIRED_ROSTER_SLOTS.find((entry) => entry.slotType === slotType)?.count ?? 0;
  return currentCount < maxCount;
}

export function summarizeRosterRequirements(existingSlots: RosterSlotType[]) {
  return REQUIRED_ROSTER_SLOTS.map((slot) => ({
    ...slot,
    selected: existingSlots.filter((candidate) => candidate === slot.slotType).length,
  }));
}
