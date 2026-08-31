export interface ScoringBreakdown {
  winPoints: number;
  coverPoints: number;
  totalPoints: number;
}

export function calculateTeamGamePoints({
  homeScore,
  awayScore,
  spreadHome,
  spreadAway,
  completed = true,
}: {
  homeScore: number;
  awayScore: number;
  spreadHome?: number | null;
  spreadAway?: number | null;
  completed?: boolean;
}): { home: ScoringBreakdown; away: ScoringBreakdown } {
  const homeWin = homeScore > awayScore ? 1 : 0;
  const awayWin = awayScore > homeScore ? 1 : 0;

  const homeCover = calculateCoverPoints({
    favoriteSpread: spreadHome,
    underdogSpread: spreadAway,
    homeScore,
    awayScore,
    isHomeTeam: true,
    completed,
  });
  const awayCover = calculateCoverPoints({
    favoriteSpread: spreadHome,
    underdogSpread: spreadAway,
    homeScore,
    awayScore,
    isHomeTeam: false,
    completed,
  });

  return {
    home: {
      winPoints: homeWin,
      coverPoints: homeCover,
      totalPoints: homeWin + homeCover,
    },
    away: {
      winPoints: awayWin,
      coverPoints: awayCover,
      totalPoints: awayWin + awayCover,
    },
  };
}

function calculateCoverPoints({
  favoriteSpread,
  underdogSpread,
  homeScore,
  awayScore,
  isHomeTeam,
  completed,
}: {
  favoriteSpread?: number | null;
  underdogSpread?: number | null;
  homeScore: number;
  awayScore: number;
  isHomeTeam: boolean;
  completed: boolean;
}) {
  // spread is negative for a favorite (e.g. -24.5) and positive for an underdog (+24.5).
  // A team covers when their actual margin PLUS their spread is positive.
  //   Home covers: (homeScore - awayScore) + spreadHome > 0
  //   Away covers: (awayScore - homeScore) + spreadAway > 0
  const spread = isHomeTeam ? favoriteSpread : underdogSpread;
  if (spread == null) {
    return completed ? 0.5 : 0;
  }

  const margin = homeScore - awayScore;
  const adjustedMargin = isHomeTeam ? margin : -margin;
  const coverMargin = adjustedMargin + spread;

  if (coverMargin > 0) {
    return 1;
  }

  if (coverMargin < 0) {
    return 0;
  }

  return 0.5;
}

export function calculateWeeklyScoreForRoster(games: Array<{
  homeScore: number;
  awayScore: number;
  spreadHome?: number | null;
  spreadAway?: number | null;
  completed?: boolean;
}>) {
  return games.reduce((total, game) => {
    const points = calculateTeamGamePoints({
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      spreadHome: game.spreadHome,
      spreadAway: game.spreadAway,
      completed: game.completed ?? true,
    });

    return total + points.home.totalPoints + points.away.totalPoints;
  }, 0);
}
