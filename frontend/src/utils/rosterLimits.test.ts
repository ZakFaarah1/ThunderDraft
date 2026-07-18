import {
  describe,
  expect,
  it,
} from "vitest";

import {
  FANTASY_ROSTER_LIMIT,
  getFantasyTeamRosterCount,
  isFantasyTeamRosterFull,
} from "./rosterLimits";

interface TestPick {
  fantasyTeamId: string;
}

/**
 * Creates a requested number of picks for one team.
 */
function createTeamPicks(
  fantasyTeamId: string,
  count: number,
): TestPick[] {
  return Array.from(
    { length: count },
    () => ({
      fantasyTeamId,
    }),
  );
}

describe("fantasy roster limits", () => {
  it("uses a fifteen-player roster", () => {
    expect(FANTASY_ROSTER_LIMIT).toBe(15);
  });

  it("counts only picks belonging to the requested team", () => {
    const picks = [
      ...createTeamPicks("thunder", 8),
      ...createTeamPicks("team-two", 5),
    ];

    expect(
      getFantasyTeamRosterCount(
        picks,
        "thunder",
      ),
    ).toBe(8);
  });

  it("allows a team with fourteen players to draft", () => {
    expect(
      isFantasyTeamRosterFull(
        createTeamPicks("thunder", 14),
        "thunder",
      ),
    ).toBe(false);
  });

  it("blocks a team with fifteen players", () => {
    expect(
      isFantasyTeamRosterFull(
        createTeamPicks("thunder", 15),
        "thunder",
      ),
    ).toBe(true);
  });

  it("continues blocking a roster beyond the limit", () => {
    expect(
      isFantasyTeamRosterFull(
        createTeamPicks("thunder", 16),
        "thunder",
      ),
    ).toBe(true);
  });
});
