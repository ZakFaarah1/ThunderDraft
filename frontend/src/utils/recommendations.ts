import { recommendationWeights } from "../config/recommendationWeights";

import type {
  Player,
  Position,
  Recommendation,
} from "../types";

interface ScoreResult {
  score: number;
  reasons: string[];
}

export interface RecommendationContext {
  currentOverallPick: number | null;
  picksUntilNextTurn: number | null;
  recentDraftedPlayers?: Player[];
}

const starterTargets: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
};

const depthTargets: Record<Position, number> = {
  QB: 1,
  RB: 4,
  WR: 4,
  TE: 2,
  K: 1,
  DST: 1,
};

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
    score += recommendationWeights.flexDepthBonus;

    reasons.push(
      "Adds useful FLEX or bench depth",
    );
  }

  if (
    player.position === "QB" &&
    currentPositionCount >= 1
  ) {
    score -=
      recommendationWeights
        .duplicateQuarterbackPenalty;
  }

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
 * Scores whether a player may disappear before the next turn.
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
 * Scores a player when their position is being drafted rapidly.
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
 * Scores players followed by a major positional drop.
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

  if (
    rankingAdvantage <
    recommendationWeights.marketAdvantageMinimum
  ) {
    return {
      score: 0,
      reasons: [],
    };
  }

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
 * Calculates the base score from overall rank, tier, and
 * positional rank.
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
 * Adds a score result and its reasons to a recommendation.
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
 * Ranks players using value, need, timing, tiers, and trends.
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

  return availablePlayers
    .map((player): Recommendation => {
      const reasons: string[] = [];

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

      if (player.tier === 1) {
        reasons.push(
          "Elite Tier 1 option",
        );
      } else {
        reasons.push(
          `Strong Tier ${player.tier} value`,
        );
      }

      if (player.overallRank <= 12) {
        reasons.push(
          "First-round overall talent",
        );
      }

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