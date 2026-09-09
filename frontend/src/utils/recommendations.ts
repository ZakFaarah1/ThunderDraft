import { recommendationWeights } from "../config/recommendationWeights";

import type {
  DraftStrategy,
  Player,
  Position,
  Recommendation,
} from "../types";

import {
  getRosterHealthReport,
  type RosterHealthReport,
} from "./rosterHealth";

interface ScoreResult {
  score: number;
  reasons: string[];
}

export interface RecommendationContext {
  currentOverallPick: number | null;
  picksUntilNextTurn: number | null;
  recentDraftedPlayers?: Player[];
  strategy?: DraftStrategy;
}

/*
 * Defines the minimum number of starters needed
 * at each position.
 */
const starterTargets: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
};

/*
 * Defines the preferred depth target for each position.
 */
const depthTargets: Record<Position, number> = {
  QB: 1,
  RB: 4,
  WR: 4,
  TE: 2,
  K: 1,
  DST: 1,
};


/**
 * Adjusts recommendations to match the user's selected
 * mock-draft strategy without overriding obvious player value.
 */
function getDraftStrategyScore(
  player: Player,
  userDraftedPlayers: Player[],
  strategy: DraftStrategy,
): ScoreResult {
  if (strategy === "balanced") {
    return {
      score: 0,
      reasons: [],
    };
  }

  const reasons: string[] = [];
  let score = 0;

  const currentRound =
    userDraftedPlayers.length + 1;

  const positionCounts =
    countPlayersByPosition(
      userDraftedPlayers,
    );

  const isElitePlayer =
    player.tier <= 2;

  if (
    strategy ===
    "best-player-available"
  ) {
    const talentBonus = Math.max(
      0,
      26 -
        player.overallRank * 0.35 -
        (player.tier - 1) * 3,
    );

    score += talentBonus;

    if (talentBonus > 0) {
      reasons.push(
        "Best Player Available fit: prioritizes elite talent over positional need",
      );
    }
  }

  if (strategy === "hero-rb") {
    if (
      player.position === "RB" &&
      positionCounts.RB === 0 &&
      currentRound <= 3
    ) {
      score += 40;

      reasons.push(
        "Hero RB fit: gives you the early anchor running back this strategy needs",
      );
    } else if (
      player.position === "RB" &&
      positionCounts.RB >= 1 &&
      currentRound <= 5
    ) {
      score -= 18;
    } else if (
      player.position !== "RB" &&
      positionCounts.RB === 0 &&
      currentRound <= 2
    ) {
      score -= 10;
    }

    if (
      player.position === "WR" &&
      positionCounts.RB >= 1 &&
      currentRound <= 6
    ) {
      score += 18;

      reasons.push(
        "Hero RB fit: builds receiver depth after securing your anchor back",
      );
    }
  }

  if (strategy === "zero-rb") {
    if (
      player.position === "RB" &&
      currentRound <= 4
    ) {
      score -= 36;
    }

    if (
      player.position === "WR" &&
      currentRound <= 5
    ) {
      score += 28;

      reasons.push(
        "Zero RB fit: prioritizes an early wide receiver foundation",
      );
    }

    if (
      player.position === "TE" &&
      isElitePlayer &&
      currentRound <= 4
    ) {
      score += 20;

      reasons.push(
        "Zero RB fit: elite tight end value supports the early-round build",
      );
    }

    if (
      player.position === "QB" &&
      isElitePlayer &&
      currentRound <= 5
    ) {
      score += 16;

      reasons.push(
        "Zero RB fit: elite quarterback value complements the early receiver build",
      );
    }

    if (
      player.position === "RB" &&
      currentRound >= 5 &&
      currentRound <= 9
    ) {
      score += 28;

      reasons.push(
        "Zero RB fit: this is the value window for adding running backs",
      );
    }
  }

  if (strategy === "robust-rb") {
    if (
      player.position === "RB" &&
      currentRound <= 4 &&
      positionCounts.RB < 3
    ) {
      score += 34;

      reasons.push(
        "Robust RB fit: strengthens the early running back core",
      );
    }

    if (
      player.position === "RB" &&
      positionCounts.RB >= 3
    ) {
      score -= 16;
    }
  }

  if (strategy === "wr-heavy") {
    if (
      player.position === "WR" &&
      currentRound <= 6 &&
      positionCounts.WR < 4
    ) {
      score += 28;

      reasons.push(
        "WR Heavy fit: builds the deep receiver group your strategy prioritizes",
      );
    }

    if (
      player.position === "WR" &&
      positionCounts.WR >= 5
    ) {
      score -= 12;
    }
  }

  if (
    strategy === "early-elite-qb"
  ) {
    if (
      player.position === "QB" &&
      isElitePlayer &&
      currentRound <= 4 &&
      positionCounts.QB === 0
    ) {
      score += 38;

      reasons.push(
        "Early Elite QB fit: secures a difference-making quarterback",
      );
    }

    if (
      player.position === "QB" &&
      !isElitePlayer &&
      currentRound <= 4
    ) {
      score -= 18;
    }

    if (
      player.position === "QB" &&
      positionCounts.QB >= 1
    ) {
      score -= 24;
    }
  }

  if (strategy === "elite-te") {
    if (
      player.position === "TE" &&
      isElitePlayer &&
      currentRound <= 4 &&
      positionCounts.TE === 0
    ) {
      score += 38;

      reasons.push(
        "Elite TE fit: secures the positional advantage your strategy targets",
      );
    }

    if (
      player.position === "TE" &&
      !isElitePlayer &&
      currentRound <= 4
    ) {
      score -= 18;
    }

    if (
      player.position === "TE" &&
      positionCounts.TE >= 1
    ) {
      score -= 20;
    }
  }

  return {
    score,
    reasons,
  };
}

/**
 * Counts the user's drafted players at each position.
 */
function countPlayersByPosition(
  players: Player[],
): Record<Position, number> {
  const counts: Record<Position, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DST: 0,
  };

  players.forEach((player) => {
    counts[player.position] += 1;
  });

  return counts;
}

/**
 * Scores a player based on open starters and roster depth.
 */
function getRosterNeedScore(
  player: Player,
  positionCounts: Record<Position, number>,
  totalUserPicks: number,
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;

  const currentPositionCount =
    positionCounts[player.position];

  const starterTarget =
    starterTargets[player.position];

  const depthTarget =
    depthTargets[player.position];

  /*
   * Prioritizes players who fill an unfilled starting
   * position on the user's roster.
   */
  if (currentPositionCount < starterTarget) {
    if (
      player.position === "RB" ||
      player.position === "WR"
    ) {
      score +=
        recommendationWeights.rbWrStarterNeedBonus;
    } else if (
      player.position === "QB" ||
      player.position === "TE"
    ) {
      score +=
        recommendationWeights.qbTeStarterNeedBonus;
    } else {
      score +=
        recommendationWeights
          .kickerDefenseStarterNeedBonus;
    }

    reasons.push(
      `Fills an open ${player.position} starter`,
    );
  } else if (
    currentPositionCount < depthTarget &&
    ["RB", "WR", "TE"].includes(player.position)
  ) {
    /*
     * Rewards useful skill-position depth after the
     * starting lineup requirement has been met.
     */
    score += recommendationWeights.flexDepthBonus;

    reasons.push(
      "Adds useful FLEX or bench depth",
    );
  }

  /*
   * Reduces the value of drafting a second quarterback
   * before other roster needs are addressed.
   */
  if (
    player.position === "QB" &&
    currentPositionCount >= 1
  ) {
    score -=
      recommendationWeights
        .duplicateQuarterbackPenalty;
  }

  /*
   * Reduces the value of drafting more than two
   * tight ends.
   */
  if (
    player.position === "TE" &&
    currentPositionCount >= 2
  ) {
    score -=
      recommendationWeights.extraTightEndPenalty;
  }

  const isKickerOrDefense =
    player.position === "K" ||
    player.position === "DST";

  const isEarlyDraft =
    totalUserPicks <
    recommendationWeights
      .earlyKickerDefensePickThreshold;

  /*
   * Discourages kicker and defense selections before
   * core starters and depth are secured.
   */
  if (isKickerOrDefense && isEarlyDraft) {
    score -=
      recommendationWeights
        .earlyKickerDefensePenalty;
  }

  return {
    score,
    reasons,
  };
}

/**
 * Scores players who address the roster's most urgent
 * weaknesses.
 */
function getRosterHealthScore(
  player: Player,
  rosterHealthReport: RosterHealthReport,
): ScoreResult {
  const reasons: string[] = [];
  let score = 0;

  const weaknessIndex =
    rosterHealthReport.weakestPositions.indexOf(
      player.position,
    );

  /*
   * Gives the largest adaptive bonus to the position
   * identified as the roster's biggest weakness.
   */
  if (weaknessIndex === 0) {
    score +=
      recommendationWeights
        .weakestPositionBonus;

    reasons.push(
      `Addresses your biggest ${player.position} weakness`,
    );
  } else if (weaknessIndex === 1) {
    /*
     * Gives a smaller bonus to the roster's second-most
     * important positional weakness.
     */
    score +=
      recommendationWeights
        .secondaryWeakPositionBonus;

    reasons.push(
      `Strengthens a weak ${player.position} group`,
    );
  }

  /*
   * Adds more value when the health report contains
   * severe issues tied to this position.
   */
  if (
    weaknessIndex === 0 ||
    weaknessIndex === 1
  ) {
    const positionIssuePriority =
      rosterHealthReport.issues
        .filter(
          (issue) =>
            issue.position ===
            player.position,
        )
        .reduce(
          (totalPriority, issue) =>
            totalPriority +
            issue.priority,
          0,
        );

    score +=
      positionIssuePriority *
      recommendationWeights
        .rosterIssuePriorityMultiplier;
  }

  const hasFlexDepthIssue =
    rosterHealthReport.issues.some(
      (issue) =>
        issue.position === "FLEX",
    );

  const isFlexPosition =
    player.position === "RB" ||
    player.position === "WR" ||
    player.position === "TE";

  /*
   * Rewards RB, WR, and TE players when the roster
   * lacks enough FLEX-capable depth.
   */
  if (
    hasFlexDepthIssue &&
    isFlexPosition
  ) {
    score +=
      recommendationWeights.flexHealthBonus;

    reasons.push(
      "Improves thin FLEX depth",
    );
  }

  /*
   * Prevents roster-health bonuses from overwhelming
   * overall player value and draft timing.
   */
  return {
    score: Math.min(
      recommendationWeights
        .maximumRosterHealthBonus,
      score,
    ),
    reasons,
  };
}

/**
 * Scores whether a player may disappear before the
 * user's next turn.
 */
function getNextTurnUrgencyScore(
  player: Player,
  context?: RecommendationContext,
): ScoreResult {
  if (
    !context ||
    context.currentOverallPick === null ||
    context.picksUntilNextTurn === null ||
    context.picksUntilNextTurn <= 0
  ) {
    return {
      score: 0,
      reasons: [],
    };
  }

  const nextUserPick =
    context.currentOverallPick +
    context.picksUntilNextTurn +
    1;

  const expectedDraftPick =
    player.adp ?? player.overallRank;

  let score = 0;
  const reasons: string[] = [];

  /*
   * Rewards a player who has already fallen past their
   * expected draft position.
   */
  if (
    expectedDraftPick <=
    context.currentOverallPick
  ) {
    score =
      recommendationWeights.fallingPlayerBonus;

    reasons.push(
      "Falling past expected draft range",
    );
  } else if (expectedDraftPick <= nextUserPick) {
    /*
     * Raises urgency when the player is unlikely to
     * remain available at the user's next selection.
     */
    const distanceInsideWindow =
      nextUserPick - expectedDraftPick;

    score = Math.min(
      recommendationWeights.maximumNextTurnBonus,
      recommendationWeights.nextTurnBaseBonus +
        distanceInsideWindow *
          recommendationWeights
            .nextTurnDistanceMultiplier,
    );

    reasons.push(
      "Unlikely to reach your next turn",
    );
  } else if (
    expectedDraftPick <=
    nextUserPick +
      recommendationWeights.nearNextTurnRange
  ) {
    /*
     * Adds a smaller urgency bonus when the player's
     * draft range is just beyond the next turn.
     */
    score =
      recommendationWeights.nearNextTurnBonus;

    reasons.push(
      "Could be gone before your next turn",
    );
  }

  /*
   * Prevents low-ranked players from receiving an
   * excessive urgency bonus.
   */
  if (
    player.overallRank >
    nextUserPick +
      recommendationWeights
        .lowRankUrgencyBuffer
  ) {
    score = Math.min(
      score,
      recommendationWeights.lowRankUrgencyCap,
    );
  }

  return {
    score,
    reasons,
  };
}

/**
 * Scores a player when their position is being drafted
 * rapidly by other teams.
 */
function getPositionRunScore(
  player: Player,
  context?: RecommendationContext,
): ScoreResult {
  if (
    !context?.recentDraftedPlayers ||
    context.recentDraftedPlayers.length < 2
  ) {
    return {
      score: 0,
      reasons: [],
    };
  }

  /*
   * Kicker and defense runs should not encourage
   * early reaches.
   */
  if (
    player.position === "K" ||
    player.position === "DST"
  ) {
    return {
      score: 0,
      reasons: [],
    };
  }

  const recentDraftWindow =
    context.recentDraftedPlayers.slice(
      -recommendationWeights
        .recentDraftWindowSize,
    );

  const recentPositionSelections =
    recentDraftWindow.filter(
      (draftedPlayer) =>
        draftedPlayer.position ===
        player.position,
    ).length;

  /*
   * Applies the strongest run bonus when four or more
   * recent picks came from the same position.
   */
  if (
    recentPositionSelections >=
    recommendationWeights
      .acceleratingRunMinimum
  ) {
    return {
      score:
        recommendationWeights
          .acceleratingRunBonus,
      reasons: [
        `${player.position} run is accelerating`,
      ],
    };
  }

  /*
   * Applies a moderate bonus when a positional run is
   * beginning to develop.
   */
  if (
    recentPositionSelections >=
    recommendationWeights.developingRunMinimum
  ) {
    return {
      score:
        recommendationWeights
          .developingRunBonus,
      reasons: [
        `${player.position} run developing`,
      ],
    };
  }

  const hasLongWait =
    context.picksUntilNextTurn !== null &&
    context.picksUntilNextTurn >=
      recommendationWeights
        .risingDemandPickThreshold;

  /*
   * Applies a smaller demand bonus when two recent
   * selections occurred and the user has a long wait.
   */
  if (
    recentPositionSelections >=
      recommendationWeights.risingDemandMinimum &&
    hasLongWait
  ) {
    return {
      score:
        recommendationWeights
          .risingDemandBonus,
      reasons: [
        `${player.position} demand is rising`,
      ],
    };
  }

  return {
    score: 0,
    reasons: [],
  };
}

/**
 * Scores players followed by a major positional value
 * or tier drop.
 */
function getTierDropScore(
  player: Player,
  availablePlayers: Player[],
): ScoreResult {
  const laterPositionPlayers =
    availablePlayers
      .filter(
        (availablePlayer) =>
          availablePlayer.position ===
            player.position &&
          availablePlayer.id !== player.id &&
          availablePlayer.overallRank >
            player.overallRank,
      )
      .sort(
        (firstPlayer, secondPlayer) =>
          firstPlayer.overallRank -
          secondPlayer.overallRank,
      );

  const nextPositionPlayer =
    laterPositionPlayers[0];

  /*
   * Rewards the final available player at a position.
   */
  if (!nextPositionPlayer) {
    return {
      score:
        recommendationWeights.lastPositionBonus,
      reasons: [
        `Last available ${player.position} option`,
      ],
    };
  }

  const rankDrop =
    nextPositionPlayer.overallRank -
    player.overallRank;

  const hasTierDrop =
    nextPositionPlayer.tier > player.tier;

  /*
   * Rewards the final player remaining before the next
   * positional tier begins.
   */
  if (hasTierDrop) {
    return {
      score: Math.min(
        recommendationWeights
          .maximumTierDropBonus,
        recommendationWeights
          .tierDropBaseBonus +
          rankDrop *
            recommendationWeights
              .tierDropRankMultiplier,
      ),
      reasons: [
        `Last ${player.position} in Tier ${player.tier}`,
      ],
    };
  }

  /*
   * Rewards a player when the next same-position option
   * is significantly lower in the rankings.
   */
  if (
    rankDrop >=
    recommendationWeights.majorRankDropMinimum
  ) {
    return {
      score: Math.min(
        recommendationWeights
          .maximumMajorRankDropBonus,
        rankDrop *
          recommendationWeights
            .majorRankDropMultiplier,
      ),
      reasons: [
        `Major ${player.position} value drop after this pick`,
      ],
    };
  }

  return {
    score: 0,
    reasons: [],
  };
}

/**
 * Scores players who rank better than their market ADP.
 */
function getMarketValueScore(
  player: Player,
): ScoreResult {
  if (player.adp === null) {
    return {
      score: 0,
      reasons: [],
    };
  }

  const rankingAdvantage =
    player.adp - player.overallRank;

  /*
   * Ignores small differences between internal rank
   * and market ADP.
   */
  if (
    rankingAdvantage <
    recommendationWeights.marketAdvantageMinimum
  ) {
    return {
      score: 0,
      reasons: [],
    };
  }

  /*
   * Rewards players who are ranked meaningfully ahead
   * of their average market draft position.
   */
  return {
    score: Math.min(
      recommendationWeights
        .maximumMarketAdvantageBonus,
      rankingAdvantage *
        recommendationWeights
          .marketAdvantageMultiplier,
    ),
    reasons: [
      "Ranks ahead of market ADP",
    ],
  };
}

/**
 * Calculates the base score from overall rank, tier,
 * and positional rank.
 */
function getBasePlayerScore(
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
        recommendationWeights
          .tierBonusReduction,
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
 * Adds one scoring result and its explanations to the
 * current recommendation.
 */
function applyScoreResult(
  currentScore: number,
  reasons: string[],
  result: ScoreResult,
): number {
  reasons.push(...result.reasons);

  return currentScore + result.score;
}

/**
 * Ranks available players using talent, roster health,
 * draft timing, tiers, market value, and positional trends.
 */
export function getRecommendations(
  availablePlayers: Player[],
  userDraftedPlayers: Player[],
  limit = 5,
  context?: RecommendationContext,
): Recommendation[] {
  const positionCounts =
    countPlayersByPosition(
      userDraftedPlayers,
    );

  /*
   * Calculates roster weaknesses once before scoring
   * every available player.
   */
  const rosterHealthReport =
    getRosterHealthReport(
      userDraftedPlayers,
    );

  return availablePlayers
    .map((player): Recommendation => {
      const reasons: string[] = [];

      /*
       * Begins with the player's overall talent,
       * positional rank, and tier.
       */
      let score =
        getBasePlayerScore(player);

      const rosterNeed =
        getRosterNeedScore(
          player,
          positionCounts,
          userDraftedPlayers.length,
        );

      score = applyScoreResult(
        score,
        reasons,
        rosterNeed,
      );

      const strategyScore =
        getDraftStrategyScore(
          player,
          userDraftedPlayers,
          context?.strategy ??
            "balanced",
        );

      score = applyScoreResult(
        score,
        reasons,
        strategyScore,
      );

      /*
       * Adjusts the recommendation using the roster's
       * most urgent weaknesses.
       */
      const rosterHealth =
        getRosterHealthScore(
          player,
          rosterHealthReport,
        );

      score = applyScoreResult(
        score,
        reasons,
        rosterHealth,
      );

      /*
       * Accounts for whether the player is likely to
       * survive until the user's next turn.
       */
      const urgency =
        getNextTurnUrgencyScore(
          player,
          context,
        );

      score = applyScoreResult(
        score,
        reasons,
        urgency,
      );

      /*
       * Reacts to recent runs at the player's position.
       */
      const positionRun =
        getPositionRunScore(
          player,
          context,
        );

      score = applyScoreResult(
        score,
        reasons,
        positionRun,
      );

      /*
       * Accounts for upcoming positional tier and
       * ranking drops.
       */
      const tierDrop =
        getTierDropScore(
          player,
          availablePlayers,
        );

      score = applyScoreResult(
        score,
        reasons,
        tierDrop,
      );

      /*
       * Adds a general tier explanation to the visible
       * recommendation reasons.
       */
      if (player.tier === 1) {
        reasons.push(
          "Elite Tier 1 option",
        );
      } else {
        reasons.push(
          `Strong Tier ${player.tier} value`,
        );
      }

      /*
       * Highlights players with first-round-level
       * overall rankings.
       */
      if (player.overallRank <= 12) {
        reasons.push(
          "First-round overall talent",
        );
      }

      /*
       * Adds value when internal rankings are more
       * favorable than market ADP.
       */
      const marketValue =
        getMarketValueScore(player);

      score = applyScoreResult(
        score,
        reasons,
        marketValue,
      );

      return {
        playerId: player.id,
        score:
          Math.round(score * 10) / 10,
        reasons: reasons.slice(0, 4),
      };
    })
    .sort(
      (
        firstRecommendation,
        secondRecommendation,
      ) =>
        secondRecommendation.score -
        firstRecommendation.score,
    )
    .slice(0, limit);
}