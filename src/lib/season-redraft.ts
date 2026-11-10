export type SeasonRedraftMove = {
  managerName: string;
  dropTeam: string;
  pickupTeam: string;
  effectiveWeek: number;
  moveOrder: number;
};

const REDRAFT_MOVES_BY_SEASON: Record<number, SeasonRedraftMove[]> = {
  2026: [
    { managerName: "Joe Moeller", dropTeam: "Fresno State", pickupTeam: "North Carolina", effectiveWeek: 4, moveOrder: 1 },
    { managerName: "Joe Moeller", dropTeam: "NC State", pickupTeam: "Louisiana", effectiveWeek: 4, moveOrder: 2 },
    { managerName: "Danny Chryst", dropTeam: "Western Kentucky", pickupTeam: "Duke", effectiveWeek: 4, moveOrder: 3 },
    { managerName: "Danny Chryst", dropTeam: "South Carolina", pickupTeam: "Northwestern", effectiveWeek: 4, moveOrder: 4 },
    { managerName: "Danny Chryst", dropTeam: "Minnesota", pickupTeam: "Harvard", effectiveWeek: 4, moveOrder: 5 },
    { managerName: "Michael Miller", dropTeam: "Marshall", pickupTeam: "Tulsa", effectiveWeek: 4, moveOrder: 6 },
    { managerName: "Maddie Negaard", dropTeam: "Drake", pickupTeam: "Villanova", effectiveWeek: 4, moveOrder: 7 },
    { managerName: "Noah Corwin", dropTeam: "Villanova", pickupTeam: "Idaho State", effectiveWeek: 4, moveOrder: 8 },
    { managerName: "Sally Ehrmann", dropTeam: "Abilene Christian", pickupTeam: "William and Mary", effectiveWeek: 4, moveOrder: 9 },
  ],
};

export function getSeasonRedraftMoves(season: number) {
  return REDRAFT_MOVES_BY_SEASON[season] ?? [];
}

export function sortSeasonRedraftMoves(moves: SeasonRedraftMove[]) {
  return [...moves].sort((left, right) => {
    if (left.effectiveWeek !== right.effectiveWeek) {
      return left.effectiveWeek - right.effectiveWeek;
    }
    return left.moveOrder - right.moveOrder;
  });
}
