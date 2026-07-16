import type { DraftFormat } from "../types";

export interface PickDetails {
  overallPick: number;
  round: number;
  pickInRound: number;
  fantasyTeam: number;
}

export function getFantasyTeamForPick(
  overallPick: number,
  teamCount: number,
  draftFormat: DraftFormat = "snake",
): number {
  if (overallPick < 1) {
    throw new Error("Overall pick must be at least 1.");
  }

  if (teamCount < 2) {
    throw new Error("League must contain at least 2 teams.");
  }

  const round =
    Math.floor((overallPick - 1) / teamCount) + 1;

  const positionInRound =
    ((overallPick - 1) % teamCount) + 1;

  if (draftFormat === "linear" || round % 2 === 1) {
    return positionInRound;
  }

  return teamCount - positionInRound + 1;
}

export function getPickDetails(
  overallPick: number,
  teamCount: number,
  draftFormat: DraftFormat = "snake",
): PickDetails {
  const round =
    Math.floor((overallPick - 1) / teamCount) + 1;

  const pickInRound =
    ((overallPick - 1) % teamCount) + 1;

  return {
    overallPick,
    round,
    pickInRound,
    fantasyTeam: getFantasyTeamForPick(
      overallPick,
      teamCount,
      draftFormat,
    ),
  };
}

export function getUserOverallPicks(
  draftSlot: number,
  teamCount: number,
  totalRounds: number,
  draftFormat: DraftFormat = "snake",
): number[] {
  if (draftSlot < 1 || draftSlot > teamCount) {
    throw new Error(
      `Draft slot must be between 1 and ${teamCount}.`,
    );
  }

  const picks: number[] = [];

  for (let round = 1; round <= totalRounds; round += 1) {
    const isReversed =
      draftFormat === "snake" && round % 2 === 0;

    const pickInRound = isReversed
      ? teamCount - draftSlot + 1
      : draftSlot;

    picks.push(
      (round - 1) * teamCount + pickInRound,
    );
  }

  return picks;
}

export function getPicksUntilNextTurn(
  currentOverallPick: number,
  userPicks: number[],
): number | null {
  const nextUserPick = userPicks.find(
    (pick) => pick >= currentOverallPick,
  );

  if (nextUserPick === undefined) {
    return null;
  }

  return nextUserPick - currentOverallPick;
}
