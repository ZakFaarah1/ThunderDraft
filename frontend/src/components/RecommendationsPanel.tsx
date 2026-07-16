import type {
  Player,
  Recommendation,
} from "../types";

import { getRecommendations } from "../utils/recommendations";

interface RecommendationsPanelProps {
  availablePlayers: Player[];
  userDraftedPlayers: Player[];
  recentDraftedPlayers: Player[];
  currentOverallPick: number;
  picksUntilNextTurn: number | null;
  onDraftPlayer: (player: Player) => void;
}

interface FeaturedRecommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  player: Player;
  reasons: string[];
  scoreLabel: string;
  scoreValue: string;
  badge: string;
}

/**
 * Creates initials when a player does not have a headshot.
 */
function getPlayerInitials(
  playerName: string,
): string {
  return playerName
    .split(" ")
    .map((namePart) => namePart[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Finds the player connected to a recommendation result.
 */
function getPlayerForRecommendation(
  recommendation: Recommendation,
  availablePlayers: Player[],
): Player | null {
  return (
    availablePlayers.find(
      (availablePlayer) =>
        availablePlayer.id ===
        recommendation.playerId,
    ) ?? null
  );
}

/**
 * Finds the highest-ranked player remaining on the board.
 */
function getBestAvailablePlayer(
  availablePlayers: Player[],
): Player | null {
  const sortedPlayers = [
    ...availablePlayers,
  ].sort(
    (firstPlayer, secondPlayer) =>
      firstPlayer.overallRank -
        secondPlayer.overallRank ||
      firstPlayer.tier -
        secondPlayer.tier ||
      firstPlayer.positionRank -
        secondPlayer.positionRank,
  );

  return sortedPlayers[0] ?? null;
}

/**
 * Finds the strongest recommendation that addresses a
 * starter opening or an important roster-depth need.
 */
function getBestRosterFitRecommendation(
  recommendations: Recommendation[],
): Recommendation | null {
  const rosterFitRecommendation =
    recommendations.find((recommendation) =>
      recommendation.reasons.some(
        (reason) =>
          reason.startsWith(
            "Fills an open",
          ) ||
          reason.includes(
            "FLEX or bench depth",
          ),
      ),
    );

  return rosterFitRecommendation ?? null;
}

/**
 * Creates the explanation shown for the best available player.
 */
function getBestAvailableReasons(
  player: Player,
): string[] {
  const reasons = [
    "Highest-ranked player still available",
    `Tier ${player.tier} ${player.position}`,
    `${player.position} rank #${player.positionRank}`,
  ];

  if (player.adp !== null) {
    reasons.push(
      `Market ADP #${player.adp}`,
    );
  }

  return reasons.slice(0, 4);
}

/**
 * Builds the three adaptive recommendation categories.
 */
function buildFeaturedRecommendations(
  availablePlayers: Player[],
  recommendations: Recommendation[],
): FeaturedRecommendation[] {
  const featuredRecommendations:
    FeaturedRecommendation[] = [];

  const bestAvailablePlayer =
    getBestAvailablePlayer(
      availablePlayers,
    );

  const bestPickRecommendation =
    recommendations[0] ?? null;

  const rosterFitRecommendation =
    getBestRosterFitRecommendation(
      recommendations,
    ) ?? bestPickRecommendation;

  if (bestAvailablePlayer) {
    featuredRecommendations.push({
      id: "best-available",
      category: "Pure player value",
      title: "Best Available",
      description:
        "The highest-ranked talent remaining, regardless of your current roster.",
      player: bestAvailablePlayer,
      reasons:
        getBestAvailableReasons(
          bestAvailablePlayer,
        ),
      scoreLabel: "Overall rank",
      scoreValue: `#${bestAvailablePlayer.overallRank}`,
      badge: "Top Talent",
    });
  }

  if (rosterFitRecommendation) {
    const rosterFitPlayer =
      getPlayerForRecommendation(
        rosterFitRecommendation,
        availablePlayers,
      );

    if (rosterFitPlayer) {
      featuredRecommendations.push({
        id: "best-roster-fit",
        category: "Roster construction",
        title: "Best Roster Fit",
        description:
          "The strongest option for filling a weakness or improving your roster depth.",
        player: rosterFitPlayer,
        reasons:
          rosterFitRecommendation.reasons,
        scoreLabel: "Strategy score",
        scoreValue:
          rosterFitRecommendation.score.toString(),
        badge: "Fills a Need",
      });
    }
  }

  if (bestPickRecommendation) {
    const bestPickPlayer =
      getPlayerForRecommendation(
        bestPickRecommendation,
        availablePlayers,
      );

    if (bestPickPlayer) {
      featuredRecommendations.push({
        id: "best-pick-now",
        category: "Adaptive balanced",
        title: "Best Pick Right Now",
        description:
          "The best combination of talent, roster fit, ADP value, timing, and positional scarcity.",
        player: bestPickPlayer,
        reasons:
          bestPickRecommendation.reasons,
        scoreLabel: "Strategy score",
        scoreValue:
          bestPickRecommendation.score.toString(),
        badge: "Recommended Pick",
      });
    }
  }

  return featuredRecommendations;
}

/**
 * Displays adaptive recommendations and the overall shortlist.
 */
function RecommendationsPanel({
  availablePlayers,
  userDraftedPlayers,
  recentDraftedPlayers,
  currentOverallPick,
  picksUntilNextTurn,
  onDraftPlayer,
}: RecommendationsPanelProps) {
  const recommendations =
    getRecommendations(
      availablePlayers,
      userDraftedPlayers,
      availablePlayers.length,
      {
        currentOverallPick,
        picksUntilNextTurn,
        recentDraftedPlayers,
      },
    );

  const featuredRecommendations =
    buildFeaturedRecommendations(
      availablePlayers,
      recommendations,
    );

  const shortlist = recommendations
    .slice(0, 5)
    .map((recommendation) => {
      const player =
        getPlayerForRecommendation(
          recommendation,
          availablePlayers,
        );

      if (!player) {
        return null;
      }

      return {
        player,
        recommendation,
      };
    })
    .filter(
      (
        result,
      ): result is {
        player: Player;
        recommendation: Recommendation;
      } => result !== null,
    );

  return (
    <section className="recommendations-panel">
      <div className="recommendations-heading">
        <div>
          <p className="eyebrow">
            ThunderDraft strategy
          </p>

          <h3>Adaptive Recommendations</h3>
        </div>

        <span className="recommendation-status">
          Live analysis
        </span>
      </div>

      <p className="recommendations-description">
        ThunderDraft compares pure player value with your
        current roster needs, then recommends the strongest
        overall pick for this exact point in the draft.
      </p>

      {featuredRecommendations.length ===
      0 ? (
        <div className="recommendations-empty-state">
          No players are currently available.
        </div>
      ) : (
        <div className="featured-recommendation-list">
          {featuredRecommendations.map(
            (featuredRecommendation) => (
              <article
                className={`recommendation-card featured-recommendation-card featured-${featuredRecommendation.id}`}
                key={
                  featuredRecommendation.id
                }
              >
                <div className="recommendation-category">
                  <span>
                    {
                      featuredRecommendation.category
                    }
                  </span>

                  <strong>
                    {
                      featuredRecommendation.title
                    }
                  </strong>

                  <p>
                    {
                      featuredRecommendation.description
                    }
                  </p>
                </div>

                <div className="recommendation-headshot">
                  {featuredRecommendation.player
                    .imageUrl ? (
                    <img
                      alt={
                        featuredRecommendation.player
                          .name
                      }
                      src={
                        featuredRecommendation.player
                          .imageUrl
                      }
                    />
                  ) : (
                    <span>
                      {getPlayerInitials(
                        featuredRecommendation.player
                          .name,
                      )}
                    </span>
                  )}
                </div>

                <div className="recommendation-player">
                  <div className="recommendation-player-heading">
                    <strong>
                      {
                        featuredRecommendation.player
                          .name
                      }
                    </strong>

                    <span className="best-pick-badge">
                      {
                        featuredRecommendation.badge
                      }
                    </span>
                  </div>

                  <span>
                    {
                      featuredRecommendation.player
                        .position
                    }{" "}
                    ·{" "}
                    {
                      featuredRecommendation.player
                        .nflTeam
                    }{" "}
                    · Overall #
                    {
                      featuredRecommendation.player
                        .overallRank
                    }
                  </span>

                  <ul className="recommendation-reasons">
                    {featuredRecommendation.reasons.map(
                      (reason) => (
                        <li key={reason}>
                          {reason}
                        </li>
                      ),
                    )}
                  </ul>
                </div>

                <div className="recommendation-actions">
                  <div className="recommendation-score">
                    <span>
                      {
                        featuredRecommendation.scoreLabel
                      }
                    </span>

                    <strong>
                      {
                        featuredRecommendation.scoreValue
                      }
                    </strong>
                  </div>

                  <button
                    className="recommendation-select-button"
                    onClick={() =>
                      onDraftPlayer(
                        featuredRecommendation.player,
                      )
                    }
                    type="button"
                  >
                    Select Pick
                  </button>
                </div>
              </article>
            ),
          )}
        </div>
      )}

      {shortlist.length > 0 && (
        <>
          <div className="recommendation-shortlist-heading">
            <div>
              <p className="eyebrow">
                Overall rankings
              </p>

              <h4>Top Five Shortlist</h4>
            </div>

            <span>
              Adaptive balanced strategy
            </span>
          </div>

          <div className="recommendation-list">
            {shortlist.map(
              (
                {
                  player,
                  recommendation,
                },
                index,
              ) => (
                <article
                  className={`recommendation-card ${
                    index === 0
                      ? "top-recommendation-card"
                      : ""
                  }`}
                  key={player.id}
                >
                  <span className="recommendation-rank">
                    {index + 1}
                  </span>

                  <div className="recommendation-headshot">
                    {player.imageUrl ? (
                      <img
                        alt={player.name}
                        src={player.imageUrl}
                      />
                    ) : (
                      <span>
                        {getPlayerInitials(
                          player.name,
                        )}
                      </span>
                    )}
                  </div>

                  <div className="recommendation-player">
                    <div className="recommendation-player-heading">
                      <strong>
                        {player.name}
                      </strong>

                      {index === 0 && (
                        <span className="best-pick-badge">
                          Best Overall Pick
                        </span>
                      )}
                    </div>

                    <span>
                      {player.position} ·{" "}
                      {player.nflTeam} · Overall #
                      {player.overallRank}
                    </span>

                    <ul className="recommendation-reasons">
                      {recommendation.reasons.map(
                        (reason) => (
                          <li key={reason}>
                            {reason}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>

                  <div className="recommendation-actions">
                    <div className="recommendation-score">
                      <span>
                        Strategy score
                      </span>

                      <strong>
                        {recommendation.score}
                      </strong>
                    </div>

                    <button
                      className="recommendation-select-button"
                      onClick={() =>
                        onDraftPlayer(player)
                      }
                      type="button"
                    >
                      Select Pick
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default RecommendationsPanel;