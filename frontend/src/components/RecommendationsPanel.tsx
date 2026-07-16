import type { Player } from "../types";
import { getRecommendations } from "../utils/recommendations";

interface RecommendationsPanelProps {
  availablePlayers: Player[];
  userDraftedPlayers: Player[];
  recentDraftedPlayers: Player[];
  currentOverallPick: number;
  picksUntilNextTurn: number | null;
  onDraftPlayer: (player: Player) => void;
}

/**
 * Creates initials when a player does not have a headshot.
 */
function getPlayerInitials(playerName: string): string {
  return playerName
    .split(" ")
    .map((namePart) => namePart[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Displays the best available picks for the user's turn.
 */
function RecommendationsPanel({
  availablePlayers,
  userDraftedPlayers,
  recentDraftedPlayers,
  currentOverallPick,
  picksUntilNextTurn,
  onDraftPlayer,
}: RecommendationsPanelProps) {
  const recommendations = getRecommendations(
    availablePlayers,
    userDraftedPlayers,
    5,
    {
      currentOverallPick,
      picksUntilNextTurn,
      recentDraftedPlayers,
    },
  );

  const recommendedPlayers = recommendations
    .map((recommendation) => {
      const player = availablePlayers.find(
        (availablePlayer) =>
          availablePlayer.id === recommendation.playerId,
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
        recommendation: (typeof recommendations)[number];
      } => result !== null,
    );

  return (
    <section className="recommendations-panel">
      <div className="recommendations-heading">
        <div>
          <p className="eyebrow">
            ThunderDraft strategy
          </p>

          <h3>Recommended Picks</h3>
        </div>

        <span className="recommendation-status">
          Live analysis
        </span>
      </div>

      <p className="recommendations-description">
        Rankings account for player value, roster needs,
        market ADP, tier drops, recent positional runs, and
        whether the player may survive until your next turn.
      </p>

      <div className="recommendation-list">
        {recommendedPlayers.map(
          ({ player, recommendation }, index) => (
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
                    {getPlayerInitials(player.name)}
                  </span>
                )}
              </div>

              <div className="recommendation-player">
                <div className="recommendation-player-heading">
                  <strong>{player.name}</strong>

                  {index === 0 && (
                    <span className="best-pick-badge">
                      Best Pick
                    </span>
                  )}
                </div>

                <span>
                  {player.position} · {player.nflTeam} ·
                  Overall #{player.overallRank}
                </span>

                <ul className="recommendation-reasons">
                  {recommendation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>

              <div className="recommendation-actions">
                <div className="recommendation-score">
                  <span>Strategy score</span>

                  <strong>
                    {recommendation.score}
                  </strong>
                </div>

                <button
                  className="recommendation-select-button"
                  onClick={() => onDraftPlayer(player)}
                  type="button"
                >
                  Select Pick
                </button>
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  );
}

export default RecommendationsPanel;