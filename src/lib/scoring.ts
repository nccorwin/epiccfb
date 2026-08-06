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
}: {
  homeScore: number;
  awayScore: number;
  spreadHome?: number | null;
  spreadAway?: number | null;
}): { home: ScoringBreakdown; away: ScoringBreakdown } {
  const homeWin = homeScore > awayScore ? 1 : 0;
  const awayWin = awayScore > homeScore ? 1 : 0;

  const homeCover = calculateCoverPoints({
    favoriteSpread: spreadHome,
    underdogSpread: spreadAway,
    homeScore,
    awayScore,
    isHomeTeam: true,
  });
  const awayCover = calculateCoverPoints({
    favoriteSpread: spreadHome,
    underdogSpread: spreadAway,
    homeScore,
    awayScore,
    isHomeTeam: false,
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
}: {
  favoriteSpread?: number | null;
  underdogSpread?: number | null;
  homeScore: number;
  awayScore: number;
  isHomeTeam: boolean;
}) {
  // spread is negative for a favorite (e.g. -24.5) and positive for an underdog (+24.5).
  // A team covers when their actual margin PLUS their spread is positive.
  //   Home covers: (homeScore - awayScore) + spreadHome > 0
  //   Away covers: (awayScore - homeScore) + spreadAway > 0
  const spread = isHomeTeam ? favoriteSpread : underdogSpread;
  if (spread == null) {
    return 0;
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
}>) {
  return games.reduce((total, game) => {
    const points = calculateTeamGamePoints({
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      spreadHome: game.spreadHome,
      spreadAway: game.spreadAway,
    });

    return total + points.home.totalPoints + points.away.totalPoints;
  }, 0);
}
