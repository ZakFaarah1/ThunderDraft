import {
  describe,
  expect,
  it,
} from "vitest";

import { recommendationWeights } from "../config/recommendationWeights";

import type {
  Player,
  Position,
} from "../types";

import {
  getRecommendations,
  type RecommendationContext,
} from "./recommendations";

import {
  getRosterHealthReport,
} from "./rosterHealth";

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
 * Creates several players at the same position.
 */
function createPlayersAtPosition(
  position: Position,
  count: number,
  idPrefix = "player",
): Player[] {
  return Array.from(
    {
      length: count,
    },
    (_, index) =>
      createPlayer({
        id: `${idPrefix}-${position}-${index}`,
        name: `${position} Player ${index + 1}`,
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
  userDraftedPlayers: Player[] = [],
  context?: RecommendationContext,
) {
  const recommendation = getRecommendations(
    availablePlayers,
    userDraftedPlayers,
    availablePlayers.length,
    context,
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
 * Calculates the recommendation engine's base player score.
 */
function calculateExpectedBaseScore(
  player: Player,
): number {
  const overallRankScore =
    recommendationWeights.baseScore -
    player.overallRank *
      recommendationWeights.overallRankPenalty;

  const tierBonus = Math.max(
    0,
    recommendationWeights.maximumTierBonus -
      (player.tier - 1) *
        recommendationWeights.tierBonusReduction,
  );

  const positionRankBonus = Math.max(
    0,
    recommendationWeights
      .maximumPositionRankBonus -
      player.positionRank,
  );

  return (
    overallRankScore +
    tierBonus +
    positionRankBonus
  );
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
            createPlayersAtPosition(
              "RB",
              3,
              "recent",
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
            createPlayersAtPosition(
              "WR",
              3,
              "recent",
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
            createPlayersAtPosition(
              "K",
              4,
              "recent",
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
            createPlayersAtPosition(
              "WR",
              4,
              "recent",
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

/**
 * Verifies adaptive scoring from the roster-health report.
 */
describe("roster health recommendations", () => {
  /**
   * Confirms that the most urgent position receives the
   * strongest adaptive roster bonus.
   */
  it("prioritizes the roster's weakest position", () => {
    const runningBack = createPlayer({
      id: "health-rb",
      name: "Health Running Back",
      position: "RB",
    });

    const receiver = createPlayer({
      id: "health-wr",
      name: "Health Receiver",
      position: "WR",
    });

    const laterRunningBack = createPlayer({
      id: "later-health-rb",
      name: "Later Health Running Back",
      position: "RB",
      overallRank: 21,
      positionRank: 6,
      tier: 2,
      adp: 21,
    });

    const laterReceiver = createPlayer({
      id: "later-health-wr",
      name: "Later Health Receiver",
      position: "WR",
      overallRank: 21,
      positionRank: 6,
      tier: 2,
      adp: 21,
    });

    const availablePlayers = [
      runningBack,
      receiver,
      laterRunningBack,
      laterReceiver,
    ];

    const runningBackRecommendation =
      findRecommendation(
        runningBack.id,
        availablePlayers,
      );

    const receiverRecommendation =
      findRecommendation(
        receiver.id,
        availablePlayers,
      );

    expect(
      runningBackRecommendation.score,
    ).toBeGreaterThan(
      receiverRecommendation.score,
    );

    expect(
      runningBackRecommendation.reasons,
    ).toContain(
      "Addresses your biggest RB weakness",
    );
  });

  /**
   * Confirms that the second-weakest position receives a
   * smaller adaptive bonus than the primary weakness.
   */
  it("uses a smaller bonus for the second-weakest position", () => {
    const runningBack = createPlayer({
      id: "primary-weakness-rb",
      position: "RB",
    });

    const receiver = createPlayer({
      id: "secondary-weakness-wr",
      position: "WR",
    });

    const laterRunningBack = createPlayer({
      id: "primary-backup-rb",
      position: "RB",
      overallRank: 21,
      positionRank: 6,
    });

    const laterReceiver = createPlayer({
      id: "secondary-backup-wr",
      position: "WR",
      overallRank: 21,
      positionRank: 6,
    });

    const availablePlayers = [
      runningBack,
      receiver,
      laterRunningBack,
      laterReceiver,
    ];

    const healthReport =
      getRosterHealthReport([]);

    const runningBackIssuePriority =
      healthReport.issues
        .filter(
          (issue) =>
            issue.position === "RB",
        )
        .reduce(
          (total, issue) =>
            total + issue.priority,
          0,
        );

    const receiverIssuePriority =
      healthReport.issues
        .filter(
          (issue) =>
            issue.position === "WR",
        )
        .reduce(
          (total, issue) =>
            total + issue.priority,
          0,
        );

    const expectedPrimaryBonus =
      Math.min(
        recommendationWeights
          .maximumRosterHealthBonus,
        recommendationWeights
          .weakestPositionBonus +
          runningBackIssuePriority *
            recommendationWeights
              .rosterIssuePriorityMultiplier,
      );

    const expectedSecondaryBonus =
      Math.min(
        recommendationWeights
          .maximumRosterHealthBonus,
        recommendationWeights
          .secondaryWeakPositionBonus +
          receiverIssuePriority *
            recommendationWeights
              .rosterIssuePriorityMultiplier,
      );

    const runningBackRecommendation =
      findRecommendation(
        runningBack.id,
        availablePlayers,
      );

    const receiverRecommendation =
      findRecommendation(
        receiver.id,
        availablePlayers,
      );

    expect(
      runningBackRecommendation.score -
        receiverRecommendation.score,
    ).toBe(
      expectedPrimaryBonus -
        expectedSecondaryBonus,
    );

    expect(
      receiverRecommendation.reasons,
    ).toContain(
      "Strengthens a weak WR group",
    );
  });

  /**
   * Confirms that FLEX-capable players gain value when
   * combined RB, WR, and TE depth is thin.
   */
  it("boosts players who improve thin FLEX depth", () => {
    const runningBack = createPlayer({
      id: "flex-health-rb",
      position: "RB",
      overallRank: 40,
      positionRank: 10,
      tier: 3,
      adp: 40,
    });

    const laterRunningBack = createPlayer({
      id: "later-flex-health-rb",
      position: "RB",
      overallRank: 41,
      positionRank: 11,
      tier: 3,
      adp: 41,
    });

    const flexThinRoster = [
      ...createPlayersAtPosition(
        "QB",
        2,
        "thin",
      ),
      ...createPlayersAtPosition(
        "RB",
        2,
        "thin",
      ),
      ...createPlayersAtPosition(
        "WR",
        2,
        "thin",
      ),
      ...createPlayersAtPosition(
        "TE",
        1,
        "thin",
      ),
    ];

    const flexHealthyRoster = [
      ...flexThinRoster,
      ...createPlayersAtPosition(
        "TE",
        1,
        "healthy",
      ),
    ];

    const availablePlayers = [
      runningBack,
      laterRunningBack,
    ];

    const thinRecommendation =
      findRecommendation(
        runningBack.id,
        availablePlayers,
        flexThinRoster,
      );

    const healthyRecommendation =
      findRecommendation(
        runningBack.id,
        availablePlayers,
        flexHealthyRoster,
      );

    expect(
      thinRecommendation.score,
    ).toBe(
      healthyRecommendation.score +
        recommendationWeights
          .flexHealthBonus,
    );

    expect(
      thinRecommendation.reasons,
    ).toContain(
      "Improves thin FLEX depth",
    );
  });

  /**
   * Confirms that severe weaknesses cannot exceed the
   * configured roster-health scoring limit.
   */
  it("caps the roster health bonus", () => {
    const runningBack = createPlayer({
      id: "capped-health-rb",
      position: "RB",
    });

    const laterRunningBack = createPlayer({
      id: "later-capped-health-rb",
      position: "RB",
      overallRank: 21,
      positionRank: 6,
      tier: 2,
      adp: 21,
    });

    const recommendation =
      findRecommendation(
        runningBack.id,
        [
          runningBack,
          laterRunningBack,
        ],
      );

    const expectedScore =
      calculateExpectedBaseScore(
        runningBack,
      ) +
      recommendationWeights
        .rbWrStarterNeedBonus +
      recommendationWeights
        .maximumRosterHealthBonus;

    expect(
      recommendation.score,
    ).toBe(expectedScore);

    expect(
      recommendation.reasons,
    ).toContain(
      "Addresses your biggest RB weakness",
    );
  });
});

/**
 * Verifies that strategy presets adjust recommendations.
 */
describe("draft strategy preset recommendations", () => {
  const recommendationContext = {
    currentOverallPick: 1,
    picksUntilNextTurn: 22,
    recentDraftedPlayers: [],
  };

  it("boosts an early anchor RB for Hero RB", () => {
    const runningBack = createPlayer({
      id: "hero-rb-target",
      position: "RB",
      overallRank: 10,
      positionRank: 3,
      tier: 1,
      adp: 10,
    });

    const balanced = getSingleRecommendation(
      runningBack,
      [],
      {
        ...recommendationContext,
        strategy: "balanced",
      },
    );

    const heroRb = getSingleRecommendation(
      runningBack,
      [],
      {
        ...recommendationContext,
        strategy: "hero-rb",
      },
    );

    expect(heroRb.score).toBeGreaterThan(
      balanced.score,
    );

    expect(heroRb.reasons).toContain(
      "Hero RB fit: gives you the early anchor running back this strategy needs",
    );
  });

  it("suppresses early RBs for Zero RB", () => {
    const runningBack = createPlayer({
      id: "zero-rb-early-back",
      position: "RB",
      overallRank: 20,
      positionRank: 8,
      tier: 2,
      adp: 20,
    });

    const balanced = getSingleRecommendation(
      runningBack,
      [],
      {
        ...recommendationContext,
        strategy: "balanced",
      },
    );

    const zeroRb = getSingleRecommendation(
      runningBack,
      [],
      {
        ...recommendationContext,
        strategy: "zero-rb",
      },
    );

    expect(zeroRb.score).toBeLessThan(
      balanced.score,
    );
  });

  it("boosts early WRs for Zero RB", () => {
    const receiver = createPlayer({
      id: "zero-rb-receiver",
      position: "WR",
      overallRank: 18,
      positionRank: 7,
      tier: 2,
      adp: 18,
    });

    const balanced = getSingleRecommendation(
      receiver,
      [],
      {
        ...recommendationContext,
        strategy: "balanced",
      },
    );

    const zeroRb = getSingleRecommendation(
      receiver,
      [],
      {
        ...recommendationContext,
        strategy: "zero-rb",
      },
    );

    expect(zeroRb.score).toBeGreaterThan(
      balanced.score,
    );
  });

  it("boosts early running backs for Robust RB", () => {
    const runningBack = createPlayer({
      id: "robust-rb-target",
      position: "RB",
      overallRank: 22,
      positionRank: 9,
      tier: 2,
      adp: 22,
    });

    const balanced = getSingleRecommendation(
      runningBack,
      [],
      {
        ...recommendationContext,
        strategy: "balanced",
      },
    );

    const robustRb = getSingleRecommendation(
      runningBack,
      [],
      {
        ...recommendationContext,
        strategy: "robust-rb",
      },
    );

    expect(robustRb.score).toBeGreaterThan(
      balanced.score,
    );
  });

  it("boosts receivers for WR Heavy", () => {
    const receiver = createPlayer({
      id: "wr-heavy-target",
      position: "WR",
      overallRank: 24,
      positionRank: 10,
      tier: 3,
      adp: 24,
    });

    const balanced = getSingleRecommendation(
      receiver,
      [],
      {
        ...recommendationContext,
        strategy: "balanced",
      },
    );

    const wrHeavy = getSingleRecommendation(
      receiver,
      [],
           {
        ...recommendationContext,
        strategy: "wr-heavy",
      },
    );

    expect(wrHeavy.score).toBeGreaterThan(
      balanced.score,
    );
  });

  it("boosts only elite early QBs for Early Elite QB", () => {
    const eliteQuarterback = createPlayer({
      id: "elite-qb-target",
      position: "QB",
      overallRank: 25,
      positionRank: 2,
      tier: 1,
      adp: 25,
    });

    const ordinaryQuarterback = createPlayer({
      id: "ordinary-qb-target",
      position: "QB",
      overallRank: 55,
      positionRank: 9,
      tier: 4,
      adp: 55,
    });

    const eliteResult = findRecommendation(
      eliteQuarterback.id,
      [
        eliteQuarterback,
        ordinaryQuarterback,
      ],
      [],
      {
        ...recommendationContext,
        strategy: "early-elite-qb",
      },
    );

    const ordinaryResult = findRecommendation(
      ordinaryQuarterback.id,
      [
        eliteQuarterback,
        ordinaryQuarterback,
      ],
      [],
      {
        ...recommendationContext,
        strategy: "early-elite-qb",
      },
    );

    expect(eliteResult.score).toBeGreaterThan(
      ordinaryResult.score,
    );
  });

  it("boosts an elite early TE for Elite TE", () => {
    const tightEnd = createPlayer({
      id: "elite-te-target",
      position: "TE",
      overallRank: 28,
      positionRank: 1,
      tier: 1,
      adp: 28,
    });

    const balanced = getSingleRecommendation(
      tightEnd,
      [],
      {
        ...recommendationContext,
        strategy: "balanced",
      },
    );

    const eliteTe = getSingleRecommendation(
      tightEnd,
      [],
      {
        ...recommendationContext,
        strategy: "elite-te",
      },
    );

    expect(eliteTe.score).toBeGreaterThan(
      balanced.score,
    );
  });

  it("adds a talent bonus for Best Player Available", () => {
    const elitePlayer = createPlayer({
      id: "bpa-target",
      position: "WR",
      overallRank: 5,
      positionRank: 2,
      tier: 1,
      adp: 5,
    });

    const balanced = getSingleRecommendation(
      elitePlayer,
      [],
      {
        ...recommendationContext,
        strategy: "balanced",
      },
    );

    const bestPlayerAvailable =
      getSingleRecommendation(
        elitePlayer,
        [],
        {
          ...recommendationContext,
          strategy:
            "best-player-available",
        },
      );

    expect(
      bestPlayerAvailable.score,
    ).toBeGreaterThan(
      balanced.score,
    );
  });
});
