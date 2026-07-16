import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Player,
  Position,
} from "../types";

import {
  getRecommendations,
  type RecommendationContext,
} from "./recommendations";

/**
 * Creates a complete player object with optional test overrides.
 */
function createPlayer(
  overrides: Partial<Player> = {},
): Player {
  return {
    id: "test-player",
    name: "Test Player",
    nflTeam: "TST",
    position: "RB",
    overallRank: 20,
    positionRank: 5,
    tier: 2,
    adp: 20,
    projectedPoints: 200,
    byeWeek: 8,
    imageUrl: null,
    ...overrides,
  };
}

/**
 * Creates recent draft selections at one position.
 */
function createRecentPlayers(
  position: Position,
  count: number,
): Player[] {
  return Array.from(
    {
      length: count,
    },
    (_, index) =>
      createPlayer({
        id: `recent-${position}-${index}`,
        name: `Recent ${position} ${index + 1}`,
        position,
        overallRank: 60 + index,
        positionRank: index + 1,
        tier: 4,
        adp: 60 + index,
      }),
  );
}

/**
 * Returns the recommendation generated for one player.
 */
function getSingleRecommendation(
  player: Player,
  userDraftedPlayers: Player[] = [],
  context?: RecommendationContext,
) {
  const recommendation = getRecommendations(
    [player],
    userDraftedPlayers,
    1,
    context,
  )[0];

  if (!recommendation) {
    throw new Error(
      "Expected the player to receive a recommendation.",
    );
  }

  return recommendation;
}

/**
 * Finds one player's recommendation from a larger result set.
 */
function findRecommendation(
  playerId: string,
  availablePlayers: Player[],
) {
  const recommendation = getRecommendations(
    availablePlayers,
    [],
    availablePlayers.length,
  ).find(
    (result) =>
      result.playerId === playerId,
  );

  if (!recommendation) {
    throw new Error(
      `Expected a recommendation for ${playerId}.`,
    );
  }

  return recommendation;
}

/**
 * Verifies how the user's roster changes recommendation scores.
 */
describe("roster need recommendations", () => {
  /**
   * Confirms that a second quarterback is valued below an
   * otherwise identical quarterback filling an open starter.
   */
  it("lowers the value of a duplicate quarterback", () => {
    const quarterback = createPlayer({
      id: "available-qb",
      name: "Available Quarterback",
      position: "QB",
      overallRank: 30,
      positionRank: 5,
      tier: 3,
      adp: 30,
    });

    const draftedQuarterback = createPlayer({
      id: "drafted-qb",
      name: "Drafted Quarterback",
      position: "QB",
      overallRank: 10,
      positionRank: 1,
      tier: 1,
      adp: 10,
    });

    const openStarterRecommendation =
      getSingleRecommendation(
        quarterback,
      );

    const duplicateRecommendation =
      getSingleRecommendation(
        quarterback,
        [draftedQuarterback],
      );

    expect(
      duplicateRecommendation.score,
    ).toBe(
      openStarterRecommendation.score - 34,
    );
  });

  /**
   * Confirms that kickers receive an early-draft penalty.
   */
  it("penalizes kickers before the user's tenth pick", () => {
    const kicker = createPlayer({
      id: "available-kicker",
      name: "Available Kicker",
      position: "K",
      overallRank: 100,
      positionRank: 1,
      tier: 5,
      adp: 100,
    });

    const lateDraftRoster = Array.from(
      {
        length: 10,
      },
      (_, index) =>
        createPlayer({
          id: `roster-player-${index}`,
          name: `Roster Player ${index + 1}`,
          position: "RB",
          overallRank: index + 1,
          positionRank: index + 1,
          tier: 1,
          adp: index + 1,
        }),
    );

    const earlyRecommendation =
      getSingleRecommendation(
        kicker,
        [],
      );

    const lateRecommendation =
      getSingleRecommendation(
        kicker,
        lateDraftRoster,
      );

    expect(
      lateRecommendation.score,
    ).toBe(
      earlyRecommendation.score + 30,
    );
  });
});

/**
 * Verifies draft-position and next-turn urgency scoring.
 */
describe("next-turn urgency recommendations", () => {
  /**
   * Confirms that a player falling past ADP gains value.
   */
  it("boosts a player falling beyond the expected draft range", () => {
    const fallingPlayer = createPlayer({
      id: "falling-player",
      name: "Falling Player",
      position: "WR",
      overallRank: 14,
      positionRank: 6,
      tier: 2,
      adp: 15,
    });

    const standardRecommendation =
      getSingleRecommendation(
        fallingPlayer,
      );

    const fallingRecommendation =
      getSingleRecommendation(
        fallingPlayer,
        [],
        {
          currentOverallPick: 20,
          picksUntilNextTurn: 10,
          recentDraftedPlayers: [],
        },
      );

    expect(
      fallingRecommendation.score,
    ).toBe(
      standardRecommendation.score + 18,
    );

    expect(
      fallingRecommendation.reasons,
    ).toContain(
      "Falling past expected draft range",
    );
  });
});

/**
 * Verifies positional tier-drop scoring.
 */
describe("tier drop recommendations", () => {
  /**
   * Confirms that the final player before a lower tier gains value.
   */
  it("boosts the last player before a positional tier drop", () => {
    const finalTierOneReceiver =
      createPlayer({
        id: "tier-one-wr",
        name: "Final Tier One Receiver",
        position: "WR",
        overallRank: 10,
        positionRank: 3,
        tier: 1,
        adp: 10,
      });

    const tierTwoReceiver =
      createPlayer({
        id: "tier-two-wr",
        name: "Tier Two Receiver",
        position: "WR",
        overallRank: 11,
        positionRank: 4,
        tier: 2,
        adp: 11,
      });

    const sameTierReceiver =
      createPlayer({
        id: "same-tier-wr",
        name: "Same Tier Receiver",
        position: "WR",
        overallRank: 11,
        positionRank: 4,
        tier: 1,
        adp: 11,
      });

    const tierDropRecommendation =
      findRecommendation(
        finalTierOneReceiver.id,
        [
          finalTierOneReceiver,
          tierTwoReceiver,
        ],
      );

    const noTierDropRecommendation =
      findRecommendation(
        finalTierOneReceiver.id,
        [
          finalTierOneReceiver,
          sameTierReceiver,
        ],
      );

    expect(
      tierDropRecommendation.score,
    ).toBe(
      noTierDropRecommendation.score +
        10.5,
    );

    expect(
      tierDropRecommendation.reasons,
    ).toContain(
      "Last WR in Tier 1",
    );
  });
});

/**
 * Verifies recent positional-run scoring.
 */
describe("positional run recommendations", () => {
  /**
   * Confirms that three recent running backs increase RB urgency.
   */
  it("boosts a position when a draft run is developing", () => {
    const runningBack = createPlayer({
      id: "run-rb",
      name: "Run Running Back",
      position: "RB",
      overallRank: 25,
      positionRank: 10,
      tier: 3,
      adp: 25,
    });

    const runRecommendation =
      getSingleRecommendation(
        runningBack,
        [],
        {
          currentOverallPick: null,
          picksUntilNextTurn: 12,
          recentDraftedPlayers:
            createRecentPlayers(
              "RB",
              3,
            ),
        },
      );

    const noRunRecommendation =
      getSingleRecommendation(
        runningBack,
        [],
        {
          currentOverallPick: null,
          picksUntilNextTurn: 12,
          recentDraftedPlayers:
            createRecentPlayers(
              "WR",
              3,
            ),
        },
      );

    expect(
      runRecommendation.score,
    ).toBe(
      noRunRecommendation.score + 7,
    );

    expect(
      runRecommendation.reasons,
    ).toContain(
      "RB run developing",
    );
  });

  /**
   * Confirms that kicker runs do not encourage early reaches.
   */
  it("does not boost kickers during a kicker run", () => {
    const kicker = createPlayer({
      id: "run-kicker",
      name: "Run Kicker",
      position: "K",
      overallRank: 110,
      positionRank: 2,
      tier: 5,
      adp: 110,
    });

    const kickerRunRecommendation =
      getSingleRecommendation(
        kicker,
        [],
        {
          currentOverallPick: null,
          picksUntilNextTurn: 12,
          recentDraftedPlayers:
            createRecentPlayers(
              "K",
              4,
            ),
        },
      );

    const noRunRecommendation =
      getSingleRecommendation(
        kicker,
        [],
        {
          currentOverallPick: null,
          picksUntilNextTurn: 12,
          recentDraftedPlayers:
            createRecentPlayers(
              "WR",
              4,
            ),
        },
      );

    expect(
      kickerRunRecommendation.score,
    ).toBe(
      noRunRecommendation.score,
    );
  });
});