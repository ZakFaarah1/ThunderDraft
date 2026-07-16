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
 * Counts how many drafted players the user has at each position.
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
 * Scores a player based on the user's current roster needs.
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
      score += 28;
    } else if (
      player.position === "QB" ||
      player.position === "TE"
    ) {
      score += 22;
    } else {
      score += 6;
    }

    reasons.push(
      `Fills an open ${player.position} starter`,
    );
  } else if (
    currentPositionCount < depthTarget &&
    ["RB", "WR", "TE"].includes(player.position)
  ) {
    score += 10;
    reasons.push("Adds useful FLEX or bench depth");
  }

  if (
    player.position === "QB" &&
    currentPositionCount >= 1
  ) {
    score -= 12;
  }

  if (
    player.position === "TE" &&
    currentPositionCount >= 2
  ) {
    score -= 10;
  }

  if (
    (player.position === "K" ||
      player.position === "DST") &&
    totalUserPicks < 10
  ) {
    score -= 30;
  }

  return {
    score,
    reasons,
  };
}

/**
 * Scores whether a player is likely to survive until the next turn.
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

  if (expectedDraftPick <= context.currentOverallPick) {
    score = 18;
    reasons.push("Falling past expected draft range");
  } else if (expectedDraftPick <= nextUserPick) {
    const distanceInsideWindow =
      nextUserPick - expectedDraftPick;

    score = Math.min(
      22,
      10 + distanceInsideWindow * 0.75,
    );

    reasons.push("Unlikely to reach your next turn");
  } else if (expectedDraftPick <= nextUserPick + 3) {
    score = 4;
    reasons.push("Could be gone before your next turn");
  }

  /*
   * Prevents urgency from heavily boosting a player whose
   * overall ranking is far below the current draft range.
   */
  if (player.overallRank > nextUserPick + 8) {
    score = Math.min(score, 6);
  }

  return {
    score,
    reasons,
  };
}

/**
 * Scores players who are followed by a positional tier drop.
 */
function getTierDropScore(
  player: Player,
  availablePlayers: Player[],
): ScoreResult {
  const laterPositionPlayers = availablePlayers
    .filter(
      (availablePlayer) =>
        availablePlayer.position === player.position &&
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
      score: 14,
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
        16,
        10 + rankDrop * 0.5,
      ),
      reasons: [
        `Last ${player.position} in Tier ${player.tier}`,
      ],
    };
  }

  if (rankDrop >= 8) {
    return {
      score: Math.min(
        12,
        rankDrop * 0.75,
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
 * Scores players who rank better than their current market ADP.
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

  if (rankingAdvantage < 4) {
    return {
      score: 0,
      reasons: [],
    };
  }

  return {
    score: Math.min(
      10,
      rankingAdvantage * 0.5,
    ),
    reasons: ["Ranks ahead of market ADP"],
  };
}

/**
 * Ranks available players using value, roster need, and timing.
 */
export function getRecommendations(
  availablePlayers: Player[],
  userDraftedPlayers: Player[],
  limit = 5,
  context?: RecommendationContext,
): Recommendation[] {
  const positionCounts = countPlayersByPosition(
    userDraftedPlayers,
  );

  return availablePlayers
    .map((player): Recommendation => {
      const reasons: string[] = [];

      /*
       * Better overall ranks receive a higher base score.
       */
      let score = 120 - player.overallRank * 2;

      /*
       * Players in stronger tiers receive an additional boost.
       */
      const tierBonus = Math.max(
        0,
        18 - (player.tier - 1) * 5,
      );

      score += tierBonus;

      /*
       * Strong positional rankings receive a smaller bonus.
       */
      score += Math.max(
        0,
        10 - player.positionRank,
      );

      const rosterNeed = getRosterNeedScore(
        player,
        positionCounts,
        userDraftedPlayers.length,
      );

      score += rosterNeed.score;
      reasons.push(...rosterNeed.reasons);

      const urgency = getNextTurnUrgencyScore(
        player,
        context,
      );

      score += urgency.score;
      reasons.push(...urgency.reasons);

      const tierDrop = getTierDropScore(
        player,
        availablePlayers,
      );

      score += tierDrop.score;
      reasons.push(...tierDrop.reasons);

      if (player.tier === 1) {
        reasons.push("Elite Tier 1 option");
      } else {
        reasons.push(
          `Strong Tier ${player.tier} value`,
        );
      }

      if (player.overallRank <= 12) {
        reasons.push("First-round overall talent");
      }

      const marketValue =
        getMarketValueScore(player);

      score += marketValue.score;
      reasons.push(...marketValue.reasons);

      return {
        playerId: player.id,
        score: Math.round(score * 10) / 10,
        reasons: reasons.slice(0, 3),
      };
    })
    .sort(
      (firstRecommendation, secondRecommendation) =>
        secondRecommendation.score -
        firstRecommendation.score,
    )
    .slice(0, limit);
}