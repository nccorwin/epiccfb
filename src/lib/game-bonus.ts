export type BonusGame = {
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  notes?: string | null;
};

export type BonusBreakdown = {
  home: number;
  away: number;
};

export type PostseasonBonusTracker = {
  cfpAppearanceTeams: Set<string>;
  fcsAppearanceTeams: Set<string>;
};

function getUnderdogUpsetBonus(spread: number | null | undefined) {
  if (spread == null || spread <= 0) {
    return 0;
  }

  if (spread >= 13.5) {
    return 1.5;
  }

  if (spread >= 10) {
    return 1;
  }

  if (spread >= 7) {
    return 0.5;
  }

  return 0;
}

function isConferenceChampionshipGame(notes: string | null | undefined) {
  if (!notes) {
    return false;
  }

  return notes.includes("Championship")
    && !notes.includes("FCS Championship")
    && !notes.includes("College Football Playoff")
    && !notes.includes("National Championship");
}

function isCfpGame(notes: string | null | undefined) {
  return Boolean(notes && notes.includes("College Football Playoff"));
}

function isFcsGame(notes: string | null | undefined) {
  return Boolean(notes && notes.includes("FCS Championship"));
}

function getRoundWinBonus(notes: string | null | undefined, winningSide: "home" | "away") {
  if (!notes) {
    return 0;
  }

  if (notes.includes("Quarterfinal")) {
    return 1;
  }

  if (notes.includes("Semifinal")) {
    return 2;
  }

  if (notes.includes("National Championship") || notes === "FCS Championship") {
    return 3;
  }

  return 0;
}

export function createPostseasonBonusTracker(): PostseasonBonusTracker {
  return {
    cfpAppearanceTeams: new Set<string>(),
    fcsAppearanceTeams: new Set<string>(),
  };
}

function getCfpAppearanceBonus(notes: string | null | undefined) {
  if (!notes) {
    return 0;
  }

  if (notes.includes("Quarterfinal")) {
    return 4;
  }

  return 2;
}

function getFcsAppearanceBonus(notes: string | null | undefined) {
  if (!notes) {
    return 0;
  }

  if (notes.includes("Second Round")) {
    return 4;
  }

  return 2;
}

export function calculateGameBonusPoints({
  game,
  spreadHome,
  spreadAway,
  teamsWithCfpAppearanceBonus = new Set(),
  teamsWithFcsAppearanceBonus = new Set(),
  cfpByeTeams = new Set(),
  fcsUnderdogTeams = new Set(),
}: {
  game: BonusGame;
  spreadHome?: number | null;
  spreadAway?: number | null;
  teamsWithCfpAppearanceBonus?: Set<string>;
  teamsWithFcsAppearanceBonus?: Set<string>;
  cfpByeTeams?: Set<string>;
  fcsUnderdogTeams?: Set<string>;
}): BonusBreakdown {
  const homePoints = game.homePoints;
  const awayPoints = game.awayPoints;
  const homeWin = homePoints != null && awayPoints != null && homePoints > awayPoints;
  const awayWin = homePoints != null && awayPoints != null && awayPoints > homePoints;
  const notes = game.notes ?? null;
  let homeBonus = 0;
  let awayBonus = 0;

  if (isConferenceChampionshipGame(notes)) {
    homeBonus += 2;
    awayBonus += 2;
  }

  if (isCfpGame(notes)) {
    if (!teamsWithCfpAppearanceBonus.has(game.homeTeam)) {
      const byeBonus = cfpByeTeams.has(game.homeTeam) ? 4 : 2;
      homeBonus += byeBonus;
      teamsWithCfpAppearanceBonus.add(game.homeTeam);
    }
    if (!teamsWithCfpAppearanceBonus.has(game.awayTeam)) {
      const byeBonus = cfpByeTeams.has(game.awayTeam) ? 4 : 2;
      awayBonus += byeBonus;
      teamsWithCfpAppearanceBonus.add(game.awayTeam);
    }
  }

  if (isFcsGame(notes)) {
    if (!teamsWithFcsAppearanceBonus.has(game.homeTeam)) {
      const byeBonus = fcsUnderdogTeams.has(game.homeTeam) ? 4 : 2;
      homeBonus += byeBonus;
      teamsWithFcsAppearanceBonus.add(game.homeTeam);
    }
    if (!teamsWithFcsAppearanceBonus.has(game.awayTeam)) {
      const byeBonus = fcsUnderdogTeams.has(game.awayTeam) ? 4 : 2;
      awayBonus += byeBonus;
      teamsWithFcsAppearanceBonus.add(game.awayTeam);
    }
  }

  if (homeWin) {
    homeBonus += getUnderdogUpsetBonus(spreadHome);
    if (isCfpGame(notes)) {
      homeBonus += getRoundWinBonus(notes, "home");
    }
    if (isFcsGame(notes)) {
      homeBonus += getRoundWinBonus(notes, "home");
    }
  }

  if (awayWin) {
    awayBonus += getUnderdogUpsetBonus(spreadAway);
    if (isCfpGame(notes)) {
      awayBonus += getRoundWinBonus(notes, "away");
    }
    if (isFcsGame(notes)) {
      awayBonus += getRoundWinBonus(notes, "away");
    }
  }

  return {
    home: homeBonus,
    away: awayBonus,
  };
}

export function calculatePostseasonGameBonusPoints({
  game,
  spreadHome,
  spreadAway,
  tracker,
}: {
  game: BonusGame;
  spreadHome?: number | null;
  spreadAway?: number | null;
  tracker: PostseasonBonusTracker;
}): BonusBreakdown {
  const notes = game.notes ?? null;
  let homeBonus = 0;
  let awayBonus = 0;

  if (isCfpGame(notes)) {
    if (!tracker.cfpAppearanceTeams.has(game.homeTeam)) {
      homeBonus += getCfpAppearanceBonus(notes);
      tracker.cfpAppearanceTeams.add(game.homeTeam);
    }
    if (!tracker.cfpAppearanceTeams.has(game.awayTeam)) {
      awayBonus += getCfpAppearanceBonus(notes);
      tracker.cfpAppearanceTeams.add(game.awayTeam);
    }
  }

  if (isFcsGame(notes)) {
    if (!tracker.fcsAppearanceTeams.has(game.homeTeam)) {
      homeBonus += getFcsAppearanceBonus(notes);
      tracker.fcsAppearanceTeams.add(game.homeTeam);
    }
    if (!tracker.fcsAppearanceTeams.has(game.awayTeam)) {
      awayBonus += getFcsAppearanceBonus(notes);
      tracker.fcsAppearanceTeams.add(game.awayTeam);
    }
  }

  if (homeBonus > 0 || awayBonus > 0) {
    // no-op: appearance bonuses are handled above; win/cover bonuses still apply below
  }

  if (game.homePoints != null && game.awayPoints != null) {
    const homeWin = game.homePoints > game.awayPoints;
    const awayWin = game.awayPoints > game.homePoints;

    if (homeWin) {
      homeBonus += getUnderdogUpsetBonus(spreadHome);
      if (isCfpGame(notes)) {
        homeBonus += getRoundWinBonus(notes, "home");
      }
      if (isFcsGame(notes)) {
        homeBonus += getRoundWinBonus(notes, "home");
      }
    }

    if (awayWin) {
      awayBonus += getUnderdogUpsetBonus(spreadAway);
      if (isCfpGame(notes)) {
        awayBonus += getRoundWinBonus(notes, "away");
      }
      if (isFcsGame(notes)) {
        awayBonus += getRoundWinBonus(notes, "away");
      }
    }
  }

  return {
    home: homeBonus,
    away: awayBonus,
  };
}
