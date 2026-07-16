import type { DraftFormat } from "../types";

export interface PickDetails {
  overallPick: number;
  round: number;
  pickInRound: number;
  fantasyTeam: number;
}

/**
 * Returns the draft slot assigned to an overall pick.
 */
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

/**
 * Returns the round, round position, and team for a pick.
 */
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

/**
 * Generates every overall pick owned by one draft slot.
 */
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

  if (totalRounds < 1) {
    throw new Error(
      "The draft must contain at least one round.",
    );
  }

  const picks: number[] = [];

  for (
    let round = 1;
    round <= totalRounds;
    round += 1
  ) {
    const isReversed =
      draftFormat === "snake" && round % 2 === 0;

    const pickInRound = isReversed
      ? teamCount - draftSlot + 1
      : draftSlot;

    const overallPick =
      (round - 1) * teamCount + pickInRound;

    picks.push(overallPick);
  }

  return picks;
}

/**
 * Counts the other selections before the user's next pick.
 */
export function getPicksUntilNextTurn(
  currentOverallPick: number,
  userPicks: number[],
): number | null {
  const futureUserPicks = userPicks.filter(
    (pick) =>
      Number.isInteger(pick) &&
      pick > currentOverallPick,
  );

  if (futureUserPicks.length === 0) {
    return null;
  }

  const nextUserPick = Math.min(...futureUserPicks);

  return Math.max(
    0,
    nextUserPick - currentOverallPick - 1,
  );
}