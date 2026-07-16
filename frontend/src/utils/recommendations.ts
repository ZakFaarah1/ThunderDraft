import type {
  Player,
  Position,
  Recommendation,
} from "../types";

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

function getRosterNeedScore(
  player: Player,
  positionCounts: Record<Position, number>,
  totalUserPicks: number,
): {
  score: number;
  reasons: string[];
} {
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

export function getRecommendations(
  availablePlayers: Player[],
  userDraftedPlayers: Player[],
  limit = 5,
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
       * Highly ranked players at their position receive a
       * smaller additional boost.
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

      if (player.tier === 1) {
        reasons.push("Elite Tier 1 option");
      } else {
        reasons.push(`Strong Tier ${player.tier} value`);
      }

      if (player.overallRank <= 12) {
        reasons.push("First-round overall talent");
      }

      if (player.adp !== null) {
        const rankingAdvantage =
          player.adp - player.overallRank;

        if (rankingAdvantage >= 4) {
          score += Math.min(
            10,
            rankingAdvantage * 0.5,
          );

          reasons.push("Ranks ahead of market ADP");
        }
      }

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