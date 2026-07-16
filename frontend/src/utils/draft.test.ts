import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getFantasyTeamForPick,
  getPickDetails,
  getPicksUntilNextTurn,
  getUserOverallPicks,
} from "./draft";

/**
 * Verifies that overall picks are assigned to the correct
 * fantasy-team draft slots.
 */
describe("getFantasyTeamForPick", () => {
  /**
   * Confirms that odd snake-draft rounds use normal order.
   */
  it("assigns odd rounds in normal order", () => {
    expect(
      getFantasyTeamForPick(
        1,
        12,
        "snake",
      ),
    ).toBe(1);

    expect(
      getFantasyTeamForPick(
        4,
        12,
        "snake",
      ),
    ).toBe(4);

    expect(
      getFantasyTeamForPick(
        12,
        12,
        "snake",
      ),
    ).toBe(12);
  });

  /**
   * Confirms that even snake-draft rounds reverse the order.
   */
  it("reverses team order during even rounds", () => {
    expect(
      getFantasyTeamForPick(
        13,
        12,
        "snake",
      ),
    ).toBe(12);

    expect(
      getFantasyTeamForPick(
        21,
        12,
        "snake",
      ),
    ).toBe(4);

    expect(
      getFantasyTeamForPick(
        24,
        12,
        "snake",
      ),
    ).toBe(1);
  });

  /**
   * Confirms that linear drafts never reverse team order.
   */
  it("keeps every round in normal order for linear drafts", () => {
    expect(
      getFantasyTeamForPick(
        13,
        12,
        "linear",
      ),
    ).toBe(1);

    expect(
      getFantasyTeamForPick(
        16,
        12,
        "linear",
      ),
    ).toBe(4);
  });

  /**
   * Confirms that invalid pick and league values are rejected.
   */
  it("rejects invalid pick and league values", () => {
    expect(() =>
      getFantasyTeamForPick(
        0,
        12,
      ),
    ).toThrow(
      "Overall pick must be at least 1.",
    );

    expect(() =>
      getFantasyTeamForPick(
        1,
        1,
      ),
    ).toThrow(
      "League must contain at least 2 teams.",
    );
  });
});

/**
 * Verifies the calculated details for an individual draft pick.
 */
describe("getPickDetails", () => {
  /**
   * Confirms round, round position, and team ownership.
   */
  it("returns the correct snake-draft information", () => {
    expect(
      getPickDetails(
        21,
        12,
        "snake",
      ),
    ).toEqual({
      overallPick: 21,
      round: 2,
      pickInRound: 9,
      fantasyTeam: 4,
    });
  });
});

/**
 * Verifies the overall selections owned by one draft slot.
 */
describe("getUserOverallPicks", () => {
  /**
   * Confirms the alternating selections for draft slot four.
   */
  it("generates every pick for slot four", () => {
    expect(
      getUserOverallPicks(
        4,
        12,
        4,
        "snake",
      ),
    ).toEqual([
      4,
      21,
      28,
      45,
    ]);
  });

  /**
   * Confirms consecutive picks at the end of snake rounds.
   */
  it("generates consecutive turn picks for slot twelve", () => {
    expect(
      getUserOverallPicks(
        12,
        12,
        4,
        "snake",
      ),
    ).toEqual([
      12,
      13,
      36,
      37,
    ]);
  });

  /**
   * Confirms that a draft slot outside the league is rejected.
   */
  it("rejects an invalid draft slot", () => {
    expect(() =>
      getUserOverallPicks(
        13,
        12,
        15,
        "snake",
      ),
    ).toThrow(
      "Draft slot must be between 1 and 12.",
    );
  });

  /**
   * Confirms that a draft must contain at least one round.
   */
  it("rejects a draft with no rounds", () => {
    expect(() =>
      getUserOverallPicks(
        4,
        12,
        0,
        "snake",
      ),
    ).toThrow(
      "The draft must contain at least one round.",
    );
  });
});

/**
 * Verifies how many other selections occur before the next turn.
 */
describe("getPicksUntilNextTurn", () => {
  const userPicks = [
    4,
    21,
    28,
    45,
  ];

  /**
   * Confirms the long wait between picks four and twenty-one.
   */
  it("counts the picks between slot four turns", () => {
    expect(
      getPicksUntilNextTurn(
        4,
        userPicks,
      ),
    ).toBe(16);
  });

  /**
   * Confirms the shorter wait after the snake order reverses.
   */
  it("handles the shorter wait after the snake reversal", () => {
    expect(
      getPicksUntilNextTurn(
        21,
        userPicks,
      ),
    ).toBe(6);
  });

  /**
   * Confirms that back-to-back picks have no picks between them.
   */
  it("returns zero for consecutive selections", () => {
    expect(
      getPicksUntilNextTurn(
        12,
        [12, 13],
      ),
    ).toBe(0);
  });

  /**
   * Confirms that null is returned after the user's final pick.
   */
  it("returns null when the user has no future pick", () => {
    expect(
      getPicksUntilNextTurn(
        45,
        userPicks,
      ),
    ).toBeNull();
  });

  /**
   * Confirms that the closest future pick is found even when
   * the input array is not sorted.
   */
  it("finds the closest future pick from an unsorted array", () => {
    expect(
      getPicksUntilNextTurn(
        4,
        [
          45,
          28,
          21,
          4,
        ],
      ),
    ).toBe(16);
  });
});