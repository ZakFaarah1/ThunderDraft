/**
 * A standard ThunderDraft roster contains nine starters
 * and six bench players.
 */
export const FANTASY_ROSTER_LIMIT = 15;

interface FantasyTeamPick {
  fantasyTeamId: string | null | undefined;
}

/**
 * Counts selections assigned to one fantasy team.
 */
export function getFantasyTeamRosterCount(
  picks: readonly FantasyTeamPick[],
  fantasyTeamId: string | null | undefined,
): number {
  if (!fantasyTeamId) {
    return 0;
  }

  return picks.filter(
    (pick) =>
      pick.fantasyTeamId === fantasyTeamId,
  ).length;
}

/**
 * Reports whether a fantasy team has reached its roster cap.
 */
export function isFantasyTeamRosterFull(
  picks: readonly FantasyTeamPick[],
  fantasyTeamId: string | null | undefined,
): boolean {
  return (
    getFantasyTeamRosterCount(
      picks,
      fantasyTeamId,
    ) >= FANTASY_ROSTER_LIMIT
  );
}
