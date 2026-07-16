import type { Player } from "../types";
import { getRecommendations } from "../utils/recommendations";

interface RecommendationsPanelProps {
  availablePlayers: Player[];
  userDraftedPlayers: Player[];
  onDraftPlayer: (player: Player) => void;
}

function RecommendationsPanel({
  availablePlayers,
  userDraftedPlayers,
  onDraftPlayer,
}: RecommendationsPanelProps) {
  const recommendations = getRecommendations(
    availablePlayers,
    userDraftedPlayers,
    5,
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
        item,
      ): item is {
        player: Player;
        recommendation: (typeof recommendations)[number];
      } => item !== null,
    );

  return (
    <section className="recommendations-panel">
      <div className="recommendations-heading">
        <div>
          <p className="eyebrow">ThunderDraft strategy</p>
          <h3>Recommended Picks</h3>
        </div>

        <span className="recommendation-status">
          Live analysis
        </span>
      </div>

      <p className="recommendations-description">
        Recommendations account for overall value, player
        tier, positional balance, and your current roster.
      </p>

      {recommendedPlayers.length === 0 ? (
        <div className="draft-empty-state">
          <strong>No recommendations available</strong>

          <span>
            Add more players to the available player pool.
          </span>
        </div>
      ) : (
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
                      alt={`${player.name} headshot`}
                      src={player.imageUrl}
                    />
                  ) : (
                    <span aria-hidden="true">
                      {player.name
                        .split(" ")
                        .map((namePart) => namePart[0])
                        .join("")
                        .slice(0, 2)}
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
                    {player.position} · {player.nflTeam} ·{" "}
                    {player.position}
                    {player.positionRank} · Tier {player.tier}
                  </span>

                  <ul className="recommendation-reasons">
                    {recommendation.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>

                <div className="recommendation-actions">
                  <div className="recommendation-score">
                    <span>Score</span>
                    <strong>
                      {recommendation.score.toFixed(1)}
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
      )}
    </section>
  );
}

export default RecommendationsPanel;