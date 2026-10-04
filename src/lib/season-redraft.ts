export type SeasonRedraftMove = {
  managerName: string;
  dropTeam: string;
  pickupTeam: string;
  effectiveWeek: number;
};

const REDRAFT_MOVES_BY_SEASON: Record<number, SeasonRedraftMove[]> = {
  2026: [
    { managerName: "Joe Moeller", dropTeam: "Fresno State", pickupTeam: "North Carolina", effectiveWeek: 4 },
    { managerName: "Joe Moeller", dropTeam: "NC State", pickupTeam: "Louisiana", effectiveWeek: 4 },
    { managerName: "Danny Chryst", dropTeam: "Western Kentucky", pickupTeam: "Duke", effectiveWeek: 4 },
    { managerName: "Danny Chryst", dropTeam: "South Carolina", pickupTeam: "Northwestern", effectiveWeek: 4 },
    { managerName: "Danny Chryst", dropTeam: "Minnesota", pickupTeam: "Harvard", effectiveWeek: 4 },
    { managerName: "Michael Miller", dropTeam: "Marshall", pickupTeam: "Tulsa", effectiveWeek: 4 },
    { managerName: "Maddie Negaard", dropTeam: "Drake", pickupTeam: "Villanova", effectiveWeek: 4 },
    { managerName: "Noah Corwin", dropTeam: "Villanova", pickupTeam: "Idaho State", effectiveWeek: 4 },
    { managerName: "Sally Ehrmann", dropTeam: "Abilene Christian", pickupTeam: "William and Mary", effectiveWeek: 4 },
  ],
};

export function getSeasonRedraftMoves(season: number) {
  return REDRAFT_MOVES_BY_SEASON[season] ?? [];
}
