import { RosterSlotType } from "@prisma/client";
import {
  getBaseSlotTypeForTeam,
  resolveSlotTypeForSelection,
  type ExistingSlotSelection,
  type SlotTeamLike,
} from "@/lib/draft-slot-logic";

export const REQUIRED_ROSTER_SLOTS: Array<{ slotType: RosterSlotType; count: number }> = [
  { slotType: RosterSlotType.BIG_TEN, count: 1 },
  { slotType: RosterSlotType.BIG_TWELVE, count: 1 },
  { slotType: RosterSlotType.SEC, count: 1 },
  { slotType: RosterSlotType.ACC, count: 1 },
  { slotType: RosterSlotType.GROUP_OF_FIVE, count: 2 },
  { slotType: RosterSlotType.FCS, count: 2 },
  { slotType: RosterSlotType.WILDCARD, count: 2 },
];

export type TeamLike = SlotTeamLike;

export type ExistingRosterSelection = {
  slotType: RosterSlotType;
  team?: TeamLike | null;
};

export function getBaseRosterSlotTypeForTeam(team: TeamLike): RosterSlotType | null {
  return getBaseSlotTypeForTeam(team) as RosterSlotType;
}

export function resolveRosterSlotTypeForSelection(team: TeamLike, existingSelections: ExistingRosterSelection[]) {
  return resolveSlotTypeForSelection(
    team,
    existingSelections as ExistingSlotSelection<TeamLike>[],
  ) as RosterSlotType;
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
