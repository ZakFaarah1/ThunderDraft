import type {
  Player,
  Position,
} from "../types";

export type RosterHealthLevel =
  | "strong"
  | "watch"
  | "weak";

export type RosterHealthPosition =
  | Position
  | "FLEX";

export interface RosterHealthIssue {
  id: string;
  position: RosterHealthPosition;
  level: Exclude<
    RosterHealthLevel,
    "strong"
  >;
  title: string;
  description: string;
  priority: number;
}

export interface PositionHealth {
  position: Position;
  score: number;
  level: RosterHealthLevel;
  count: number;
  starterTarget: number;
  depthTarget: number;
  starterQuality: number;
  weakestStarterQuality: number;
  depthQuality: number;
  averageStarterAdp: number | null;
  averageStarterPositionRank: number | null;
}

export type RosterStarterSlot =
  | "QB"
  | "RB1"
  | "RB2"
  | "WR1"
  | "WR2"
  | "TE"
  | "FLEX"
  | "K"
  | "DST";

export interface RosterLineupPlayer {
  slot: RosterStarterSlot;
  playerId: string | null;
  playerName: string | null;
  position: Position | null;
  grade: number;
}

export interface RosterBenchAsset {
  playerId: string;
  playerName: string;
  position: Position;
  grade: number;
  baseGrade: number;
  benchWeight: number;
}

export interface RosterHealthReport {
  score: number;
  level: RosterHealthLevel;
  starterGrade: number;
  benchGrade: number;
  constructionGrade: number;
  benchCount: number;
  startingLineup: RosterLineupPlayer[];
  benchAssets: RosterBenchAsset[];
  issues: RosterHealthIssue[];
  strengths: string[];
  positionCounts: Record<
    Position,
    number
  >;
  positionScores: Record<
    Position,
    number
  >;
  positionHealth: Record<
    Position,
    PositionHealth
  >;
  weakestPositions: Position[];
}

interface PositionNeed {
  position: Position;
  target: number;
  priority: number;
}

interface MarketProfile {
  positionRankCeiling: number;
  adpBreakpoints: [
    number,
    number,
    number,
    number,
  ];
  qualityIssueMinimumPick: number;
  weakPriority: number;
  watchPriority: number;
}

const positionOrder: Position[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

/*
 * Defines the minimum starting lineup requirements.
 */
const starterTargets: Record<
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

/*
 * Defines the preferred roster-depth targets.
 */
const depthTargets: Record<
  Position,
  number
> = {
  QB: 1,
  RB: 4,
  WR: 4,
  TE: 2,
  K: 1,
  DST: 1,
};

/*
 * Models a one-QB roster with nine starters and six bench slots.
 */
const benchSlotTarget = 6;

const starterSlotWeights: Record<
  RosterStarterSlot,
  number
> = {
  QB: 0.11,
  RB1: 0.14,
  RB2: 0.11,
  WR1: 0.14,
  WR2: 0.11,
  TE: 0.10,
  FLEX: 0.13,
  K: 0.03,
  DST: 0.03,
};

const benchSlotWeights = [
  1,
  0.82,
  0.67,
  0.53,
  0.40,
  0.28,
];

/*
 * Defines position-specific market expectations.
 * A higher numerical ADP or position rank produces
 * a lower player-quality score.
 */
const marketProfiles: Record<
  Position,
  MarketProfile
> = {
  QB: {
    positionRankCeiling: 24,
    adpBreakpoints: [
      45,
      80,
      110,
      145,
    ],
    qualityIssueMinimumPick: 1,
    weakPriority: 16,
    watchPriority: 8,
  },
  RB: {
    positionRankCeiling: 60,
    adpBreakpoints: [
      24,
      55,
      95,
      140,
    ],
    qualityIssueMinimumPick: 0,
    weakPriority: 22,
    watchPriority: 10,
  },
  WR: {
    positionRankCeiling: 72,
    adpBreakpoints: [
      24,
      60,
      100,
      145,
    ],
    qualityIssueMinimumPick: 0,
    weakPriority: 22,
    watchPriority: 10,
  },
  TE: {
    positionRankCeiling: 30,
    adpBreakpoints: [
      36,
      75,
      115,
      150,
    ],
    qualityIssueMinimumPick: 1,
    weakPriority: 16,
    watchPriority: 8,
  },
  K: {
    positionRankCeiling: 24,
    adpBreakpoints: [
      130,
      148,
      165,
      185,
    ],
    qualityIssueMinimumPick: 10,
    weakPriority: 8,
    watchPriority: 4,
  },
  DST: {
    positionRankCeiling: 24,
    adpBreakpoints: [
      130,
      148,
      165,
      185,
    ],
    qualityIssueMinimumPick: 10,
    weakPriority: 8,
    watchPriority: 4,
  },
};

/**
 * Keeps a numeric value within the supplied range.
 */
function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

/**
 * Returns a rounded average or null when no values exist.
 */
function getAverage(
  values: number[],
): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round(
    (
      values.reduce(
        (total, value) =>
          total + value,
        0,
      ) /
      values.length
    ) * 10,
  ) / 10;
}

/**
 * Counts the drafted players at every position.
 */
function countPlayersByPosition(
  players: Player[],
): Record<Position, number> {
  const positionCounts: Record<
    Position,
    number
  > = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DST: 0,
  };

  players.forEach((player) => {
    positionCounts[player.position] += 1;
  });

  return positionCounts;
}

/**
 * Groups drafted players by fantasy position.
 */
function groupPlayersByPosition(
  players: Player[],
): Record<
  Position,
  Player[]
> {
  const groupedPlayers: Record<
    Position,
    Player[]
  > = {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DST: [],
  };

  players.forEach((player) => {
    groupedPlayers[player.position].push(
      player,
    );
  });

  return groupedPlayers;
}

/**
 * Converts a position rank into a 20–100 market score.
 */
function getPositionRankQuality(
  player: Player,
): number | null {
  if (
    !Number.isFinite(player.positionRank) ||
    player.positionRank <= 0
  ) {
    return null;
  }

  const ceiling =
    marketProfiles[player.position]
      .positionRankCeiling;

  const normalizedRank = clamp(
    player.positionRank,
    1,
    ceiling,
  );

  return Math.round(
    100 -
      (
        (
          normalizedRank - 1
        ) /
        Math.max(1, ceiling - 1)
      ) *
        80,
  );
}

/**
 * Converts overall ADP into a position-aware market score.
 */
function getAdpQuality(
  player: Player,
): number | null {
  if (
    player.adp === null ||
    !Number.isFinite(player.adp) ||
    player.adp <= 0
  ) {
    return null;
  }

  const [
    eliteCutoff,
    strongCutoff,
    starterCutoff,
    depthCutoff,
  ] =
    marketProfiles[player.position]
      .adpBreakpoints;

  if (player.adp <= eliteCutoff) {
    return Math.round(
      100 -
        (
          player.adp /
          eliteCutoff
        ) *
          10,
    );
  }

  if (player.adp <= strongCutoff) {
    const progress =
      (
        player.adp -
        eliteCutoff
      ) /
      (
        strongCutoff -
        eliteCutoff
      );

    return Math.round(
      90 - progress * 15,
    );
  }

  if (player.adp <= starterCutoff) {
    const progress =
      (
        player.adp -
        strongCutoff
      ) /
      (
        starterCutoff -
        strongCutoff
      );

    return Math.round(
      75 - progress * 20,
    );
  }

  if (player.adp <= depthCutoff) {
    const progress =
      (
        player.adp -
        starterCutoff
      ) /
      (
        depthCutoff -
        starterCutoff
      );

    return Math.round(
      55 - progress * 20,
    );
  }

  return Math.round(
    clamp(
      35 -
        (
          player.adp -
          depthCutoff
        ) *
          0.25,
      15,
      35,
    ),
  );
}

/**
 * Blends position rank and ADP into one market-quality score.
 */
function getPlayerMarketQuality(
  player: Player,
): number {
  const positionRankQuality =
    getPositionRankQuality(player);

  const adpQuality =
    getAdpQuality(player);

  if (
    positionRankQuality !== null &&
    adpQuality !== null
  ) {
    return Math.round(
      positionRankQuality * 0.65 +
        adpQuality * 0.35,
    );
  }

  if (positionRankQuality !== null) {
    return positionRankQuality;
  }

  if (adpQuality !== null) {
    return adpQuality;
  }

  /*
   * Missing market data remains draftable but is treated
   * conservatively instead of being assumed strong.
   */
  return (
    player.position === "K" ||
    player.position === "DST"
  )
    ? 50
    : 40;
}

/**
 * Converts overall draft cost into an absolute asset grade.
 */
function getOverallValueGrade(
  value: number | null,
): number | null {
  if (
    value === null ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  if (value <= 12) {
    return Math.round(
      99 -
        (
          (value - 1) /
          11
        ) * 5,
    );
  }

  if (value <= 24) {
    return Math.round(
      94 -
        (
          (value - 12) /
          12
        ) * 5,
    );
  }

  if (value <= 48) {
    return Math.round(
      89 -
        (
          (value - 24) /
          24
        ) * 11,
    );
  }

  if (value <= 84) {
    return Math.round(
      78 -
        (
          (value - 48) /
          36
        ) * 13,
    );
  }

  if (value <= 120) {
    return Math.round(
      65 -
        (
          (value - 84) /
          36
        ) * 13,
    );
  }

  if (value <= 180) {
    return Math.round(
      52 -
        (
          (value - 120) /
          60
        ) * 20,
    );
  }

  return Math.round(
    clamp(
      32 -
        (value - 180) * 0.2,
      12,
      32,
    ),
  );
}

/**
 * Converts a tier into a supporting asset-quality grade.
 */
function getTierGrade(
  player: Player,
): number | null {
  if (
    !Number.isFinite(player.tier) ||
    player.tier <= 0
  ) {
    return null;
  }

  return Math.round(
    clamp(
      100 -
        (player.tier - 1) * 12,
      20,
      100,
    ),
  );
}

/**
 * Grades one player as an absolute roster asset.
 * First-round caliber players approach the high 90s,
 * while K and DST remain capped because their weekly
 * replacement value is lower than offensive positions.
 */
function getPlayerAssetGrade(
  player: Player,
): number {
  const adpGrade =
    getOverallValueGrade(player.adp);

  const overallRankGrade =
    getOverallValueGrade(
      Number.isFinite(
        player.overallRank,
      )
        ? player.overallRank
        : null,
    );

  const positionRankGrade =
    getPositionRankQuality(player);

  const tierGrade =
    getTierGrade(player);

  let grade: number;

  if (adpGrade !== null) {
    grade =
      adpGrade * 0.60 +
      (positionRankGrade ?? 45) *
        0.30 +
      (tierGrade ?? 45) * 0.10;
  } else {
    /*
     * Missing ADP uses the remaining rankings with a
     * confidence reduction rather than receiving a free pass.
     */
    grade =
      (overallRankGrade ?? 40) *
        0.45 +
      (positionRankGrade ?? 40) *
        0.35 +
      (tierGrade ?? 40) * 0.20 -
      6;
  }

  const positionCap =
    player.position === "K" ||
    player.position === "DST"
      ? 74
      : 99;

  return Math.round(
    clamp(
      grade,
      8,
      positionCap,
    ),
  );
}

/**
 * Sorts players by absolute roster asset value.
 */
function sortPlayersByAssetGrade(
  players: Player[],
): Player[] {
  return [...players].sort(
    (firstPlayer, secondPlayer) =>
      getPlayerAssetGrade(
        secondPlayer,
      ) -
        getPlayerAssetGrade(
          firstPlayer,
        ) ||
      (
        firstPlayer.adp ??
        Number.POSITIVE_INFINITY
      ) -
        (
          secondPlayer.adp ??
          Number.POSITIVE_INFINITY
        ) ||
      firstPlayer.overallRank -
        secondPlayer.overallRank,
  );
}

interface InternalLineupSlot {
  slot: RosterStarterSlot;
  player: Player | null;
  weight: number;
}

interface RosterPowerBreakdown {
  starterGrade: number;
  benchGrade: number;
  constructionGrade: number;
  benchCount: number;
  startingLineup: RosterLineupPlayer[];
  benchAssets: RosterBenchAsset[];
}

/**
 * Removes and returns the strongest remaining player.
 */
function takeBestPlayer(
  players: Player[],
): Player | null {
  return players.shift() ?? null;
}

/**
 * Builds the strongest legal starting lineup automatically.
 */
function buildOptimalStartingLineup(
  draftedPlayers: Player[],
): InternalLineupSlot[] {
  const groupedPlayers =
    groupPlayersByPosition(
      draftedPlayers,
    );

  positionOrder.forEach((position) => {
    groupedPlayers[position] =
      sortPlayersByAssetGrade(
        groupedPlayers[position],
      );
  });

  const lineup: InternalLineupSlot[] = [
    {
      slot: "QB",
      player: takeBestPlayer(
        groupedPlayers.QB,
      ),
      weight: starterSlotWeights.QB,
    },
    {
      slot: "RB1",
      player: takeBestPlayer(
        groupedPlayers.RB,
      ),
      weight: starterSlotWeights.RB1,
    },
    {
      slot: "RB2",
      player: takeBestPlayer(
        groupedPlayers.RB,
      ),
      weight: starterSlotWeights.RB2,
    },
    {
      slot: "WR1",
      player: takeBestPlayer(
        groupedPlayers.WR,
      ),
      weight: starterSlotWeights.WR1,
    },
    {
      slot: "WR2",
      player: takeBestPlayer(
        groupedPlayers.WR,
      ),
      weight: starterSlotWeights.WR2,
    },
    {
      slot: "TE",
      player: takeBestPlayer(
        groupedPlayers.TE,
      ),
      weight: starterSlotWeights.TE,
    },
  ];

  const flexCandidates =
    sortPlayersByAssetGrade([
      ...groupedPlayers.RB,
      ...groupedPlayers.WR,
      ...groupedPlayers.TE,
    ]);

  lineup.push(
    {
      slot: "FLEX",
      player:
        flexCandidates[0] ?? null,
      weight:
        starterSlotWeights.FLEX,
    },
    {
      slot: "K",
      player: takeBestPlayer(
        groupedPlayers.K,
      ),
      weight: starterSlotWeights.K,
    },
    {
      slot: "DST",
      player: takeBestPlayer(
        groupedPlayers.DST,
      ),
      weight: starterSlotWeights.DST,
    },
  );

  return lineup;
}

/**
 * Discounts bench assets that duplicate low-value positions.
 */
function getBenchUtilityMultiplier(
  position: Position,
  priorPositionCount: number,
): number {
  if (
    position === "RB" ||
    position === "WR"
  ) {
    return 1;
  }

  if (position === "TE") {
    return priorPositionCount === 0
      ? 0.90
      : 0.65;
  }

  if (position === "QB") {
    return priorPositionCount === 0
      ? 0.82
      : 0.55;
  }

  return 0.25;
}

/**
 * Scores useful bench depth with declining slot importance.
 */
function buildBenchAssets(
  draftedPlayers: Player[],
  startingLineup: InternalLineupSlot[],
): {
  grade: number;
  count: number;
  assets: RosterBenchAsset[];
} {
  const starterIds = new Set(
    startingLineup
      .map((assignment) =>
        assignment.player?.id,
      )
      .filter(
        (playerId): playerId is string =>
          typeof playerId === "string",
      ),
  );

  const positionCounts: Record<
    Position,
    number
  > = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DST: 0,
  };

  const adjustedAssets =
    sortPlayersByAssetGrade(
      draftedPlayers.filter(
        (player) =>
          !starterIds.has(player.id),
      ),
    )
      .map((player) => {
        const priorPositionCount =
          positionCounts[player.position];

        positionCounts[player.position] +=
          1;

        const baseGrade =
          getPlayerAssetGrade(player);

        const utilityMultiplier =
          getBenchUtilityMultiplier(
            player.position,
            priorPositionCount,
          );

        return {
          player,
          baseGrade,
          adjustedGrade: Math.round(
            baseGrade *
              utilityMultiplier,
          ),
        };
      })
      .sort(
        (firstAsset, secondAsset) =>
          secondAsset.adjustedGrade -
            firstAsset.adjustedGrade ||
          secondAsset.baseGrade -
            firstAsset.baseGrade,
      );

  const selectedAssets =
    adjustedAssets.slice(
      0,
      benchSlotTarget,
    );

  const totalWeight =
    benchSlotWeights.reduce(
      (total, weight) =>
        total + weight,
      0,
    );

  const weightedGrade =
    benchSlotWeights.reduce(
      (total, weight, index) =>
        total +
        (
          selectedAssets[index]
            ?.adjustedGrade ?? 0
        ) *
          weight,
      0,
    );

  return {
    grade: Math.round(
      weightedGrade /
        totalWeight,
    ),
    count: adjustedAssets.length,
    assets: selectedAssets.map(
      (asset, index) => ({
        playerId: asset.player.id,
        playerName: asset.player.name,
        position:
          asset.player.position,
        grade: asset.adjustedGrade,
        baseGrade: asset.baseGrade,
        benchWeight:
          benchSlotWeights[index],
      }),
    ),
  };
}

/**
 * Rewards complete, balanced construction without treating
 * roster completion as equivalent to elite player quality.
 */
function getConstructionGrade(
  draftedPlayers: Player[],
  startingLineup: InternalLineupSlot[],
  benchCount: number,
): number {
  const positionCounts =
    countPlayersByPosition(
      draftedPlayers,
    );

  const filledStarterCount =
    startingLineup.filter(
      (assignment) =>
        assignment.player !== null,
    ).length;

  const starterCoverage =
    (
      filledStarterCount /
      startingLineup.length
    ) * 65;

  const benchCoverage =
    (
      Math.min(
        benchCount,
        benchSlotTarget,
      ) /
      benchSlotTarget
    ) * 15;

  let balanceScore = 0;

  if (positionCounts.RB >= 3) {
    balanceScore += 4;
  }

  if (positionCounts.WR >= 3) {
    balanceScore += 4;
  }

  if (positionCounts.QB >= 1) {
    balanceScore += 2;
  }

  if (positionCounts.TE >= 1) {
    balanceScore += 2;
  }

  if (positionCounts.K >= 1) {
    balanceScore += 1;
  }

  if (positionCounts.DST >= 1) {
    balanceScore += 1;
  }

  if (
    positionCounts.RB +
      positionCounts.WR +
      positionCounts.TE >=
    7
  ) {
    balanceScore += 6;
  }

  let penalty = 0;

  penalty += Math.max(
    0,
    positionCounts.QB - 2,
  ) * 5;

  penalty += Math.max(
    0,
    positionCounts.TE - 3,
  ) * 4;

  penalty += Math.max(
    0,
    positionCounts.K - 1,
  ) * 8;

  penalty += Math.max(
    0,
    positionCounts.DST - 1,
  ) * 8;

  if (
    draftedPlayers.length < 10 &&
    positionCounts.K +
      positionCounts.DST >
      0
  ) {
    penalty += 5;
  }

  penalty += Math.max(
    0,
    draftedPlayers.length - 15,
  ) * 3;

  return Math.round(
    clamp(
      starterCoverage +
        benchCoverage +
        balanceScore -
        penalty,
      0,
      100,
    ),
  );
}

/**
 * Produces a Sleeper-style absolute roster power breakdown.
 */
function getRosterPowerBreakdown(
  draftedPlayers: Player[],
): RosterPowerBreakdown {
  const internalLineup =
    buildOptimalStartingLineup(
      draftedPlayers,
    );

  const starterWeightTotal =
    internalLineup.reduce(
      (total, assignment) =>
        total + assignment.weight,
      0,
    );

  const starterGrade = Math.round(
    internalLineup.reduce(
      (total, assignment) =>
        total +
        (
          assignment.player
            ? getPlayerAssetGrade(
                assignment.player,
              )
            : 0
        ) *
          assignment.weight,
      0,
    ) /
      starterWeightTotal,
  );

  const bench = buildBenchAssets(
    draftedPlayers,
    internalLineup,
  );

  const constructionGrade =
    getConstructionGrade(
      draftedPlayers,
      internalLineup,
      bench.count,
    );

  return {
    starterGrade,
    benchGrade: bench.grade,
    constructionGrade,
    benchCount: bench.count,
    startingLineup:
      internalLineup.map(
        (assignment) => ({
          slot: assignment.slot,
          playerId:
            assignment.player?.id ??
            null,
          playerName:
            assignment.player?.name ??
            null,
          position:
            assignment.player
              ?.position ?? null,
          grade: assignment.player
            ? getPlayerAssetGrade(
                assignment.player,
              )
            : 0,
        }),
      ),
    benchAssets: bench.assets,
  };
}

/**
 * Sorts a position group from strongest to weakest market value.
 */
function sortPlayersByMarketQuality(
  players: Player[],
): Player[] {
  return [...players].sort(
    (firstPlayer, secondPlayer) =>
      getPlayerMarketQuality(
        secondPlayer,
      ) -
        getPlayerMarketQuality(
          firstPlayer,
        ) ||
      (
        firstPlayer.adp ??
        Number.POSITIVE_INFINITY
      ) -
        (
          secondPlayer.adp ??
          Number.POSITIVE_INFINITY
        ) ||
      firstPlayer.positionRank -
        secondPlayer.positionRank ||
      firstPlayer.overallRank -
        secondPlayer.overallRank,
  );
}

/**
 * Calculates coverage, starter quality, and depth quality.
 */
function getPositionHealth(
  position: Position,
  players: Player[],
): PositionHealth {
  const sortedPlayers =
    sortPlayersByMarketQuality(players);

  const starterTarget =
    starterTargets[position];

  const depthTarget =
    depthTargets[position];

  const starterPlayers =
    sortedPlayers.slice(
      0,
      starterTarget,
    );

  const starterQualities =
    starterPlayers.map(
      getPlayerMarketQuality,
    );

  const starterQuality = Math.round(
    starterQualities.reduce(
      (total, quality) =>
        total + quality,
      0,
    ) /
      starterTarget,
  );

  const weakestStarterQuality =
    starterPlayers.length <
    starterTarget
      ? 0
      : Math.min(
          ...starterQualities,
        );

  const depthSlotCount = Math.max(
    0,
    depthTarget - starterTarget,
  );

  const depthPlayers =
    sortedPlayers.slice(
      starterTarget,
      depthTarget,
    );

  const depthQuality =
    depthSlotCount === 0
      ? 100
      : Math.round(
          depthPlayers
            .map(
              getPlayerMarketQuality,
            )
            .reduce(
              (total, quality) =>
                total + quality,
              0,
            ) /
            depthSlotCount,
        );

  const coverageScore =
    clamp(
      (
        sortedPlayers.length /
        starterTarget
      ) * 100,
      0,
      100,
    );

  const score =
    depthSlotCount > 0
      ? Math.round(
          coverageScore * 0.35 +
            starterQuality * 0.5 +
            depthQuality * 0.15,
        )
      : Math.round(
          coverageScore * 0.4 +
            starterQuality * 0.6,
        );

  const starterAdps =
    starterPlayers
      .map((player) => player.adp)
      .filter(
        (
          adp,
        ): adp is number =>
          adp !== null &&
          Number.isFinite(adp),
      );

  const starterPositionRanks =
    starterPlayers
      .map(
        (player) =>
          player.positionRank,
      )
      .filter(
        (rank) =>
          Number.isFinite(rank) &&
          rank > 0,
      );

  return {
    position,
    score: clamp(
      score,
      0,
      100,
    ),
    level:
      getRosterHealthLevel(score),
    count: sortedPlayers.length,
    starterTarget,
    depthTarget,
    starterQuality,
    weakestStarterQuality,
    depthQuality,
    averageStarterAdp:
      getAverage(starterAdps),
    averageStarterPositionRank:
      getAverage(
        starterPositionRanks,
      ),
  };
}

/**
 * Builds market-quality health for every roster position.
 */
function buildPositionHealth(
  players: Player[],
): Record<
  Position,
  PositionHealth
> {
  const groupedPlayers =
    groupPlayersByPosition(players);

  return {
    QB: getPositionHealth(
      "QB",
      groupedPlayers.QB,
    ),
    RB: getPositionHealth(
      "RB",
      groupedPlayers.RB,
    ),
    WR: getPositionHealth(
      "WR",
      groupedPlayers.WR,
    ),
    TE: getPositionHealth(
      "TE",
      groupedPlayers.TE,
    ),
    K: getPositionHealth(
      "K",
      groupedPlayers.K,
    ),
    DST: getPositionHealth(
      "DST",
      groupedPlayers.DST,
    ),
  };
}

/**
 * Adds an issue only when another issue with the same ID
 * has not already been recorded.
 */
function addUniqueIssue(
  issues: RosterHealthIssue[],
  issue: RosterHealthIssue,
): void {
  const issueAlreadyExists =
    issues.some(
      (existingIssue) =>
        existingIssue.id === issue.id,
    );

  if (!issueAlreadyExists) {
    issues.push(issue);
  }
}

/**
 * Evaluates missing RB and WR starting positions.
 */
function addSkillStarterIssues(
  positionCounts: Record<
    Position,
    number
  >,
  issues: RosterHealthIssue[],
): void {
  const skillStarterNeeds:
    PositionNeed[] = [
      {
        position: "RB",
        target: starterTargets.RB,
        priority: 24,
      },
      {
        position: "WR",
        target: starterTargets.WR,
        priority: 24,
      },
    ];

  skillStarterNeeds.forEach(
    ({
      position,
      target,
      priority,
    }) => {
      const missingStarters =
        target -
        positionCounts[position];

      if (missingStarters <= 0) {
        return;
      }

      addUniqueIssue(issues, {
        id: `missing-${position}-starters`,
        position,
        level: "weak",
        title: `Open ${position} starter ${
          missingStarters > 1
            ? "spots"
            : "spot"
        }`,
        description:
          `Your roster still needs ${missingStarters} starting ${position}${
            missingStarters > 1
              ? "s"
              : ""
          }.`,
        priority:
          priority * missingStarters,
      });
    },
  );
}

/**
 * Evaluates quarterback and tight-end starter timing.
 */
function addCoreStarterIssues(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  const corePositions: Position[] = [
    "QB",
    "TE",
  ];

  corePositions.forEach((position) => {
    if (
      positionCounts[position] >=
      starterTargets[position]
    ) {
      return;
    }

    /*
     * Missing QB or TE is not urgent during the
     * opening rounds.
     */
    if (draftedPlayerCount < 5) {
      return;
    }

    const isLateDraft =
      draftedPlayerCount >= 9;

    addUniqueIssue(issues, {
      id: `missing-${position}-starter`,
      position,
      level: isLateDraft
        ? "weak"
        : "watch",
      title: `No starting ${position}`,
      description: isLateDraft
        ? `The draft is getting late and your ${position} starter is still open.`
        : `Begin watching the remaining ${position} tiers before value disappears.`,
      priority: isLateDraft
        ? 22
        : 10,
    });
  });
}

/**
 * Evaluates kicker and defense only during the late draft.
 */
function addLateStarterIssues(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  if (draftedPlayerCount < 10) {
    return;
  }

  const latePositions: Position[] = [
    "K",
    "DST",
  ];

  latePositions.forEach((position) => {
    if (
      positionCounts[position] >=
      starterTargets[position]
    ) {
      return;
    }

    const isVeryLateDraft =
      draftedPlayerCount >= 12;

    addUniqueIssue(issues, {
      id: `missing-${position}-starter`,
      position,
      level: isVeryLateDraft
        ? "weak"
        : "watch",
      title: `No starting ${position}`,
      description: isVeryLateDraft
        ? `Secure a ${position} before the final rounds are complete.`
        : `${position} can wait, but it should remain on the late-round checklist.`,
      priority: isVeryLateDraft
        ? 10
        : 4,
    });
  });
}

/**
 * Describes the weakest market starter at a filled position.
 */
function getMarketQualityDescription(
  player: Player,
  position: Position,
): string {
  const marketDetails: string[] = [];

  if (
    Number.isFinite(
      player.positionRank,
    ) &&
    player.positionRank > 0
  ) {
    marketDetails.push(
      `${position}${player.positionRank}`,
    );
  }

  if (
    player.adp !== null &&
    Number.isFinite(player.adp)
  ) {
    marketDetails.push(
      `ADP ${player.adp.toFixed(1)}`,
    );
  }

  const detailText =
    marketDetails.length > 0
      ? ` (${marketDetails.join(", ")})`
      : " (limited market data)";

  return (
    `${player.name} is currently your weakest ${position} starter` +
    `${detailText}. The slot is filled, but the market grade trails stronger options at the position.`
  );
}

/**
 * Flags positions that are filled with below-market starters.
 */
function addMarketQualityIssues(
  draftedPlayers: Player[],
  draftedPlayerCount: number,
  positionHealth: Record<
    Position,
    PositionHealth
  >,
  issues: RosterHealthIssue[],
): void {
  const groupedPlayers =
    groupPlayersByPosition(
      draftedPlayers,
    );

  positionOrder.forEach((position) => {
    const profile =
      marketProfiles[position];

    if (
      draftedPlayerCount <
      profile.qualityIssueMinimumPick
    ) {
      return;
    }

    if (
      groupedPlayers[position].length <
      starterTargets[position]
    ) {
      return;
    }

    const health =
      positionHealth[position];

    if (
      health.weakestStarterQuality >= 68
    ) {
      return;
    }

    const starterPlayers =
      sortPlayersByMarketQuality(
        groupedPlayers[position],
      ).slice(
        0,
        starterTargets[position],
      );

    const weakestStarter =
      [...starterPlayers].sort(
        (firstPlayer, secondPlayer) =>
          getPlayerMarketQuality(
            firstPlayer,
          ) -
          getPlayerMarketQuality(
            secondPlayer,
          ),
      )[0];

    if (!weakestStarter) {
      return;
    }

    const isWeak =
      health.weakestStarterQuality < 48;

    addUniqueIssue(issues, {
      id: `${
        isWeak ? "weak" : "watch"
      }-${position}-starter-quality`,
      position,
      level: isWeak
        ? "weak"
        : "watch",
      title: isWeak
        ? `Weak ${position} starter quality`
        : `${position} starter quality trails the market`,
      description:
        getMarketQualityDescription(
          weakestStarter,
          position,
        ),
      priority: isWeak
        ? profile.weakPriority
        : profile.watchPriority,
    });
  });
}

/**
 * Evaluates RB and WR depth after the early rounds.
 */
function addSkillDepthIssues(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  if (draftedPlayerCount < 6) {
    return;
  }

  const desiredDepth =
    draftedPlayerCount >= 10
      ? 4
      : 3;

  const depthPositions: Position[] = [
    "RB",
    "WR",
  ];

  depthPositions.forEach((position) => {
    const missingDepth =
      desiredDepth -
      positionCounts[position];

    if (missingDepth <= 0) {
      return;
    }

    addUniqueIssue(issues, {
      id: `thin-${position}-depth`,
      position,
      level:
        draftedPlayerCount >= 10
          ? "weak"
          : "watch",
      title: `Thin ${position} depth`,
      description:
        `Your roster has ${positionCounts[position]} ${position}${
          positionCounts[position] === 1
            ? ""
            : "s"
        }; the current depth target is ${desiredDepth}.`,
      priority:
        draftedPlayerCount >= 10
          ? 16
          : 9,
    });
  });
}

/**
 * Evaluates the combined depth available for the FLEX spot.
 */
function addFlexDepthIssue(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  if (draftedPlayerCount < 7) {
    return;
  }

  const flexPlayerCount =
    positionCounts.RB +
    positionCounts.WR +
    positionCounts.TE;

  const flexDepthTarget =
    draftedPlayerCount >= 10
      ? 8
      : 6;

  if (
    flexPlayerCount >=
    flexDepthTarget
  ) {
    return;
  }

  addUniqueIssue(issues, {
    id: "thin-flex-depth",
    position: "FLEX",
    level:
      draftedPlayerCount >= 10
        ? "weak"
        : "watch",
    title: "Limited FLEX depth",
    description:
      `You have ${flexPlayerCount} combined RB, WR, and TE options; the current target is ${flexDepthTarget}.`,
    priority:
      draftedPlayerCount >= 10
        ? 14
        : 7,
  });
}

/**
 * Detects early overinvestment at low-priority positions.
 */
function addOverinvestmentIssues(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  if (
    positionCounts.QB > 1 &&
    draftedPlayerCount < 10
  ) {
    addUniqueIssue(issues, {
      id: "early-backup-qb",
      position: "QB",
      level: "watch",
      title: "Early backup quarterback",
      description:
        "A second quarterback may have reduced your RB or WR depth.",
      priority: 14,
    });
  }

  if (
    positionCounts.TE > 2 &&
    draftedPlayerCount < 11
  ) {
    addUniqueIssue(issues, {
      id: "excess-tight-ends",
      position: "TE",
      level: "watch",
      title: "Heavy tight-end investment",
      description:
        "More than two tight ends can create weaknesses at RB or WR.",
      priority: 12,
    });
  }

  if (
    draftedPlayerCount < 10 &&
    positionCounts.K +
      positionCounts.DST >
      0
  ) {
    addUniqueIssue(issues, {
      id: "early-kicker-defense",
      position:
        positionCounts.K > 0
          ? "K"
          : "DST",
      level: "watch",
      title:
        "Early kicker or defense selection",
      description:
        "Kicker and defense are usually better addressed after core depth is secured.",
      priority: 16,
    });
  }

  if (positionCounts.QB > 2) {
    addUniqueIssue(issues, {
      id: "too-many-quarterbacks",
      position: "QB",
      level: "weak",
      title: "Too many quarterbacks",
      description:
        "Three quarterbacks consume roster space that is usually more valuable at RB or WR.",
      priority: 22,
    });
  }
}

/**
 * Identifies roster strengths that should be preserved.
 */
function getRosterStrengths(
  positionCounts: Record<
    Position,
    number
  >,
  positionHealth: Record<
    Position,
    PositionHealth
  >,
): string[] {
  const strengths: string[] = [];

  if (
    positionCounts.RB >=
    starterTargets.RB
  ) {
    strengths.push(
      "Starting RB spots covered",
    );
  }

  if (
    positionCounts.WR >=
    starterTargets.WR
  ) {
    strengths.push(
      "Starting WR spots covered",
    );
  }

  if (
    positionCounts.RB >=
    depthTargets.RB
  ) {
    strengths.push(
      "Strong RB depth",
    );
  }

  if (
    positionCounts.WR >=
    depthTargets.WR
  ) {
    strengths.push(
      "Strong WR depth",
    );
  }

  if (
    positionCounts.QB >= 1 &&
    positionCounts.TE >= 1
  ) {
    strengths.push(
      "QB and TE starters secured",
    );
  }

  const flexPlayerCount =
    positionCounts.RB +
    positionCounts.WR +
    positionCounts.TE;

  if (flexPlayerCount >= 8) {
    strengths.push(
      "Strong FLEX competition",
    );
  }

  positionOrder.forEach((position) => {
    if (
      positionCounts[position] >=
        starterTargets[position] &&
      positionHealth[position]
        .starterQuality >= 82
    ) {
      strengths.push(
        `Strong ${position} market quality`,
      );
    }
  });

  return Array.from(
    new Set(strengths),
  );
}

/**
 * Determines the overall roster-health label.
 */
function getRosterHealthLevel(
  score: number,
): RosterHealthLevel {
  if (score >= 78) {
    return "strong";
  }

  if (score >= 55) {
    return "watch";
  }

  return "weak";
}

/**
 * Returns the positions connected to the most urgent issues.
 */
function getWeakestPositions(
  issues: RosterHealthIssue[],
): Position[] {
  const positionPriorities =
    new Map<Position, number>();

  issues.forEach((issue) => {
    if (issue.position === "FLEX") {
      return;
    }

    const currentPriority =
      positionPriorities.get(
        issue.position,
      ) ?? 0;

    positionPriorities.set(
      issue.position,
      currentPriority +
        issue.priority,
    );
  });

  return Array.from(
    positionPriorities.entries(),
  )
    .sort(
      (
        firstPosition,
        secondPosition,
      ) =>
        secondPosition[1] -
        firstPosition[1],
    )
    .map(
      ([position]) => position,
    );
}

/**
 * Creates a complete health report for the user's roster.
 */
export function getRosterHealthReport(
  draftedPlayers: Player[],
): RosterHealthReport {
  const positionCounts =
    countPlayersByPosition(
      draftedPlayers,
    );

  const positionHealth =
    buildPositionHealth(
      draftedPlayers,
    );

  const issues: RosterHealthIssue[] =
    [];

  addSkillStarterIssues(
    positionCounts,
    issues,
  );

  addCoreStarterIssues(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  addLateStarterIssues(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  addMarketQualityIssues(
    draftedPlayers,
    draftedPlayers.length,
    positionHealth,
    issues,
  );

  addSkillDepthIssues(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  addFlexDepthIssue(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  addOverinvestmentIssues(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  const sortedIssues = issues.sort(
    (firstIssue, secondIssue) =>
      secondIssue.priority -
      firstIssue.priority,
  );

  const rosterPower =
    getRosterPowerBreakdown(
      draftedPlayers,
    );

  /*
   * Starter talent drives the rating, bench assets matter,
   * and construction rewards balance. A normal roster can
   * never reach 100; even a theoretical superteam caps at 99.
   */
  const score = Math.round(
    clamp(
      rosterPower.starterGrade *
        0.62 +
        rosterPower.benchGrade *
          0.23 +
        rosterPower.constructionGrade *
          0.15,
      0,
      99,
    ),
  );

  const positionScores: Record<
    Position,
    number
  > = {
    QB: positionHealth.QB.score,
    RB: positionHealth.RB.score,
    WR: positionHealth.WR.score,
    TE: positionHealth.TE.score,
    K: positionHealth.K.score,
    DST: positionHealth.DST.score,
  };

  return {
    score,
    level:
      getRosterHealthLevel(score),
    starterGrade:
      rosterPower.starterGrade,
    benchGrade:
      rosterPower.benchGrade,
    constructionGrade:
      rosterPower.constructionGrade,
    benchCount:
      rosterPower.benchCount,
    startingLineup:
      rosterPower.startingLineup,
    benchAssets:
      rosterPower.benchAssets,
    issues: sortedIssues,
    strengths:
      getRosterStrengths(
        positionCounts,
        positionHealth,
      ),
    positionCounts,
    positionScores,
    positionHealth,
    weakestPositions:
      getWeakestPositions(
        sortedIssues,
      ),
  };
}
