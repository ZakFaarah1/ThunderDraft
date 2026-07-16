import type {
  ApiDraftPlayer,
} from "./types";

import type {
  Player,
  Position,
  RankingSource,
} from "../types";


const rookieRankOffset = 180;
const unrankedPlayerOffset = 500;


/**
 * Returns the temporary draft rank used until a complete
 * ThunderDraft projection ranking is generated.
 */
function getProvisionalOverallRank(
  player: ApiDraftPlayer,
  sourceIndex: number,
): number {
  if (player.thunderDraftRank !== null) {
    return player.thunderDraftRank;
  }

  if (player.marketRank !== null) {
    return player.marketRank;
  }

  if (
    player.isRookie &&
    player.rookieRank !== null
  ) {
    return (
      rookieRankOffset +
      player.rookieRank
    );
  }

  return (
    unrankedPlayerOffset +
    sourceIndex +
    1
  );
}


/**
 * Describes where the player's temporary rank came from.
 */
function getRankingSource(
  player: ApiDraftPlayer,
): RankingSource {
  if (player.thunderDraftRank !== null) {
    return "ThunderDraft 2026";
  }

  if (player.marketRank !== null) {
    return "2026 market ADP";
  }

  if (player.isRookie) {
    return "2026 rookie estimate";
  }

  return "Unranked pool";
}


/**
 * Creates a provisional position tier for recommendation scoring.
 */
function getProvisionalTier(
  position: Position,
  positionRank: number,
): number {
  const playersPerTier =
    position === "RB" || position === "WR"
      ? 12
      : position === "K" ||
          position === "DST"
        ? 8
        : 6;

  return Math.min(
    9,
    Math.floor(
      (positionRank - 1) /
        playersPerTier,
    ) + 1,
  );
}


/**
 * Converts backend draft records into the shared frontend model.
 */
export function mapApiDraftPlayers(
  apiPlayers: ApiDraftPlayer[],
): Player[] {
  const rankedPlayers = apiPlayers
    .map((player, sourceIndex) => ({
      player,
      sourceIndex,
      overallRank:
        getProvisionalOverallRank(
          player,
          sourceIndex,
        ),
    }))
    .sort(
      (
        firstPlayer,
        secondPlayer,
      ) =>
        firstPlayer.overallRank -
          secondPlayer.overallRank ||
        (
          firstPlayer.player.adp ??
          Number.POSITIVE_INFINITY
        ) -
          (
            secondPlayer.player.adp ??
            Number.POSITIVE_INFINITY
          ) ||
        firstPlayer.player.name.localeCompare(
          secondPlayer.player.name,
        ),
    );

  const positionCounts = new Map<
    Position,
    number
  >();

  return rankedPlayers.map(
    ({ player, overallRank }) => {
      const positionRank =
        (
          positionCounts.get(
            player.position,
          ) ?? 0
        ) + 1;

      positionCounts.set(
        player.position,
        positionRank,
      );

      return {
        id: player.id,
        name: player.name,
        nflTeam: player.nflTeam,
        position: player.position,

        overallRank,
        positionRank,
        tier:
          player.tier ??
          getProvisionalTier(
            player.position,
            positionRank,
          ),

        adp: player.adp,
        projectedPoints:
          player.projectedPoints,
        byeWeek: player.byeWeek,
        imageUrl:
          player.imageUrl ??
          player.fallbackImageUrl,

        gsisId: player.gsisId,
        yearsExperience:
          player.yearsExperience,
        injuryStatus:
          player.injuryStatus,
        depthChartPosition:
          player.depthChartPosition,
        depthChartOrder:
          player.depthChartOrder,

        isRookie: player.isRookie,
        rookieRank: player.rookieRank,
        projectionSource:
          player.projectionSource,
        projectionConfidence:
          player.projectionConfidence,

        draftSeason:
          player.draftSeason,
        rankingSource:
          getRankingSource(player),
      };
    },
  );
}
