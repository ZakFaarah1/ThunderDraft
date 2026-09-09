import type {
  Player,
  Position,
} from "../types";

export type MockDraftCpuStyle =
  | "balanced"
  | "adp-heavy"
  | "chaotic";

export interface CpuDraftCandidate {
  player: Player;
  score: number;
  reasons: string[];
}

export interface SelectCpuDraftPlayerOptions {
  availablePlayers: Player[];
  roster: Player[];
  overallPick: number;
  cpuStyle: MockDraftCpuStyle;
  teamCount?: number;
  random?: () => number;
}

interface CpuStyleSettings {
  adpWeight: number;
  rankingWeight: number;
  rosterWeight: number;
  randomRange: number;
  candidatePoolSize: number;
  selectionTemperature: number;
}

/**
 * Maximum number of players the CPU may draft at each position.
 */
const POSITION_LIMITS: Record<
  Position,
  number
> = {
  QB: 2,
  RB: 6,
  WR: 6,
  TE: 3,
  K: 1,
  DST: 1,
};

/**
 * Starting-lineup requirements used by CPU roster logic.
 */
const STARTER_TARGETS: Record<
  Position,
  number
> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
};

/**
 * Preferred roster depth before a position receives penalties.
 */
const DEPTH_TARGETS: Record<
  Position,
  number
> = {
  QB: 2,
  RB: 5,
  WR: 5,
  TE: 2,
  K: 1,
  DST: 1,
};

/**
 * Returns the behavior settings for one CPU draft style.
 */
function getCpuStyleSettings(
  cpuStyle: MockDraftCpuStyle,
): CpuStyleSettings {
  if (cpuStyle === "adp-heavy") {
    return {
      adpWeight: 1.8,
      rankingWeight: 0.8,
      rosterWeight: 0.85,
      randomRange: 8,
      candidatePoolSize: 5,
      selectionTemperature: 12,
    };
  }

  if (cpuStyle === "chaotic") {
    return {
      adpWeight: 0.8,
      rankingWeight: 0.85,
      rosterWeight: 0.75,
      randomRange: 95,
      candidatePoolSize: 16,
      selectionTemperature: 58,
    };
  }

  return {
    adpWeight: 1,
    rankingWeight: 1,
    rosterWeight: 1,
    randomRange: 22,
    candidatePoolSize: 8,
    selectionTemperature: 24,
  };
}

/**
 * Counts a roster's players at each fantasy position.
 */
function countRosterPositions(
  roster: Player[],
): Record<Position, number> {
  const counts: Record<Position, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DST: 0,
  };

  roster.forEach((player) => {
    counts[player.position] += 1;
  });

  return counts;
}

/**
 * Prevents impossible or excessively unbalanced CPU rosters.
 */
function canDraftPosition(
  position: Position,
  positionCounts: Record<
    Position,
    number
  >,
): boolean {
  return (
    positionCounts[position] <
    POSITION_LIMITS[position]
  );
}

/**
 * Scores a player's overall ranking and tier.
 */
function getRankingScore(
  player: Player,
): number {
  const overallRankScore = Math.max(
    0,
    390 -
      Math.max(
        player.overallRank - 1,
        0,
      ) *
        2.7,
  );

  const tierScore = Math.max(
    0,
    82 -
      Math.max(player.tier - 1, 0) *
        13,
  );

  const positionRankScore = Math.max(
    0,
    38 -
      Math.max(
        player.positionRank - 1,
        0,
      ) *
        1.5,
  );

  return (
    overallRankScore +
    tierScore +
    positionRankScore
  );
}

/**
 * Scores market value relative to the current selection.
 */
function getAdpScore(
  player: Player,
  overallPick: number,
): number {
  if (player.adp === null) {
    return 0;
  }

  const valueDifference =
    overallPick - player.adp;

  const valueScore = Math.max(
    -55,
    Math.min(
      105,
      valueDifference * 5,
    ),
  );

  const marketQualityScore = Math.max(
    0,
    210 -
      Math.max(player.adp - 1, 0) *
        1.3,
  );

  return valueScore + marketQualityScore;
}

/**
 * Scores how well a player fills the CPU team's roster.
 */
function getRosterNeedScore(
  player: Player,
  positionCounts: Record<
    Position,
    number
  >,
  round: number,
): {
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];

  const currentCount =
    positionCounts[player.position];

  const starterTarget =
    STARTER_TARGETS[player.position];

  const depthTarget =
    DEPTH_TARGETS[player.position];

  let score = 0;

  if (currentCount < starterTarget) {
    if (
      player.position === "RB" ||
      player.position === "WR"
    ) {
      score += 72;
    } else if (
      player.position === "QB" ||
      player.position === "TE"
    ) {
      score += 38;
    } else if (round >= 12) {
      score += 55;
    } else {
      score -= 165;
    }

    reasons.push(
      `Fills an open ${player.position} starter`,
    );
  } else if (currentCount < depthTarget) {
    if (
      player.position === "RB" ||
      player.position === "WR"
    ) {
      score += 24;
      reasons.push(
        "Adds useful skill-position depth",
      );
    } else if (player.position === "TE") {
      score += round >= 8 ? 12 : -18;
    } else if (player.position === "QB") {
      score += round >= 9 ? 10 : -35;
    }
  } else {
    score -=
      player.position === "RB" ||
      player.position === "WR"
        ? 28
        : 85;
  }

  return {
    score,
    reasons,
  };
}

/**
 * Applies broad round-based roster strategy.
 */
function getRoundStrategyScore(
  player: Player,
  positionCounts: Record<
    Position,
    number
  >,
  round: number,
): number {
  let score = 0;

  if (
    player.position === "RB" ||
    player.position === "WR"
  ) {
    if (round <= 8) {
      score += 16;
    }
  }

  if (player.position === "QB") {
    if (
      positionCounts.QB === 0 &&
      round >= 7
    ) {
      score += 28;
    }

    if (
      positionCounts.QB >= 1 &&
      round < 10
    ) {
      score -= 55;
    }
  }

  if (
    player.position === "TE" &&
    positionCounts.TE >= 1 &&
    round < 9
  ) {
    score -= 42;
  }

  if (
    player.position === "K" ||
    player.position === "DST"
  ) {
    if (round < 12) {
      score -= 230;
    } else {
      score +=
        positionCounts[player.position] ===
        0
          ? 45
          : -150;
    }
  }

  return score;
}

/**
 * Generates a random score adjustment for outcome variation.
 */
function getRandomAdjustment(
  random: () => number,
  range: number,
): number {
  return (
    (random() * 2 - 1) *
    range
  );
}

/**
 * Ranks every legal CPU candidate for the current pick.
 */
export function rankCpuDraftCandidates(
  options: SelectCpuDraftPlayerOptions,
): CpuDraftCandidate[] {
  const {
    availablePlayers,
    roster,
    overallPick,
    cpuStyle,
    teamCount = 12,
    random = Math.random,
  } = options;

  if (roster.length >= 15) {
    return [];
  }

  const round =
    Math.floor(
      (overallPick - 1) / teamCount,
    ) + 1;

  const positionCounts =
    countRosterPositions(roster);

  const settings =
    getCpuStyleSettings(cpuStyle);

  return availablePlayers
    .filter((player) =>
      canDraftPosition(
        player.position,
        positionCounts,
      ),
    )
    .map((player): CpuDraftCandidate => {
      const reasons: string[] = [];

      const rankingScore =
        getRankingScore(player) *
        settings.rankingWeight;

      const adpScore =
        getAdpScore(
          player,
          overallPick,
        ) * settings.adpWeight;

      const rosterNeed =
        getRosterNeedScore(
          player,
          positionCounts,
          round,
        );

      const rosterScore =
        rosterNeed.score *
        settings.rosterWeight;

      reasons.push(
        ...rosterNeed.reasons,
      );

      const roundStrategyScore =
        getRoundStrategyScore(
          player,
          positionCounts,
          round,
        );

      const projectionScore =
        player.projectedPoints === null
          ? 0
          : Math.min(
              player.projectedPoints / 8,
              45,
            );

      const randomAdjustment =
        getRandomAdjustment(
          random,
          settings.randomRange,
        );

      const score =
        rankingScore +
        adpScore +
        rosterScore +
        roundStrategyScore +
        projectionScore +
        randomAdjustment;

      if (
        player.adp !== null &&
        player.adp < overallPick
      ) {
        reasons.push(
          "Available later than market ADP",
        );
      }

      if (player.tier === 1) {
        reasons.push(
          "Elite Tier 1 player",
        );
      }

      return {
        player,
        score,
        reasons,
      };
    })
    .sort(
      (firstCandidate, secondCandidate) =>
        secondCandidate.score -
        firstCandidate.score,
    );
}

/**
 * Selects one CPU player using weighted randomness.
 */
export function selectCpuDraftPlayer(
  options: SelectCpuDraftPlayerOptions,
): Player | null {
  const random =
    options.random ?? Math.random;

  const settings =
    getCpuStyleSettings(
      options.cpuStyle,
    );

  const candidates =
    rankCpuDraftCandidates({
      ...options,
      random,
    }).slice(
      0,
      settings.candidatePoolSize,
    );

  if (candidates.length === 0) {
    return null;
  }

  const highestScore =
    candidates[0].score;

  const candidateWeights =
    candidates.map((candidate) =>
      Math.exp(
        (candidate.score -
          highestScore) /
          settings.selectionTemperature,
      ),
    );

  const totalWeight =
    candidateWeights.reduce(
      (sum, weight) =>
        sum + weight,
      0,
    );

  let selectionPoint =
    random() * totalWeight;

  for (
    let index = 0;
    index < candidates.length;
    index += 1
  ) {
    selectionPoint -=
      candidateWeights[index];

    if (selectionPoint <= 0) {
      return candidates[index].player;
    }
  }

  return candidates[
    candidates.length - 1
  ].player;
}

/**
 * Creates repeatable randomness for a mock-draft scenario.
 *
 * The same seed produces the same sequence of CPU decisions.
 */
export function createSeededRandom(
  seed: number,
): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;

    let result = state;

    result = Math.imul(
      result ^ (result >>> 15),
      result | 1,
    );

    result ^=
      result +
      Math.imul(
        result ^ (result >>> 7),
        result | 61,
      );

    return (
      ((result ^ (result >>> 14)) >>>
        0) /
      4294967296
    );
  };
}

/**
 * Generates a new numeric scenario seed.
 */
export function createMockDraftSeed(): number {
  return Math.floor(
    Math.random() * 2147483647,
  );
}
