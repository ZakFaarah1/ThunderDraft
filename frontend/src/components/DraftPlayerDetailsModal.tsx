import {
  useEffect,
  useState,
} from "react";

import { fetchPlayerHistory } from "../api/client";

import type {
  ApiPlayerHistoryResponse,
} from "../api/types";

import type { Player } from "../types";


interface DraftPlayerDetailsModalProps {
  player: Player;
  isUserOnClock: boolean;
  onClose: () => void;
  onDraftPlayer: (player: Player) => void;
}


/**
 * Formats an optional fantasy number.
 */
function formatFantasyNumber(
  value: number | null | undefined,
): string {
  return value === null || value === undefined
    ? "—"
    : value.toFixed(1);
}


/**
 * Formats a whole-number statistic with commas.
 */
function formatWholeNumber(
  value: number,
): string {
  return value.toLocaleString();
}


/**
 * Creates initials when a headshot is unavailable.
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
 * Creates the current depth-chart description.
 */
function getDepthChartLabel(
  player: Player,
): string {
  if (
    !player.depthChartPosition &&
    player.depthChartOrder === null
  ) {
    return "Not listed";
  }

  const position =
    player.depthChartPosition ??
    player.position;

  const order =
    player.depthChartOrder !== null &&
    player.depthChartOrder !== undefined
      ? ` #${player.depthChartOrder}`
      : "";

  return `${position}${order}`;
}


/**
 * Creates the correct no-history explanation.
 */
function getNoHistoryMessage(
  player: Player,
): string {
  if (player.isRookie) {
    return (
      "No NFL history yet. The 2026 projection above " +
      "is a ThunderDraft rookie estimate."
    );
  }

  if (
    player.position === "K" ||
    player.position === "DST"
  ) {
    return (
      "Historical offensive fantasy statistics are " +
      "not currently available for this position."
    );
  }

  return (
    "Historical NFL statistics are not currently " +
    "linked to this player."
  );
}


/**
 * Displays one labeled value inside the popup.
 */
function ModalStatistic({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="stats-modal-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}


/**
 * Displays the player headshot or initials.
 */
function ModalPlayerHeadshot({
  player,
}: {
  player: Player;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  /*
   * Resets failed-image state when the player changes.
   */
  useEffect(() => {
    setImageFailed(false);
  }, [player.imageUrl]);

  const shouldShowImage =
    Boolean(player.imageUrl) &&
    !imageFailed;

  return (
    <div className="stats-player-headshot stats-modal-headshot">
      {shouldShowImage && player.imageUrl ? (
        <img
          alt={`${player.name} headshot`}
          onError={() => {
            setImageFailed(true);
          }}
          src={player.imageUrl}
        />
      ) : (
        <span aria-hidden="true">
          {getPlayerInitials(player.name)}
        </span>
      )}
    </div>
  );
}


/**
 * Displays the draft outlook and historical NFL production.
 */
function DraftPlayerDetailsModal({
  player,
  isUserOnClock,
  onClose,
  onDraftPlayer,
}: DraftPlayerDetailsModalProps) {
  const [
    history,
    setHistory,
  ] =
    useState<ApiPlayerHistoryResponse | null>(
      null,
    );

  const [
    isHistoryLoading,
    setIsHistoryLoading,
  ] = useState(false);

  const [
    historyError,
    setHistoryError,
  ] = useState<string | null>(null);

  /*
   * Loads historical seasons when a GSIS identifier exists.
   */
  useEffect(() => {
    setHistory(null);
    setHistoryError(null);

    if (!player.gsisId) {
      setIsHistoryLoading(false);
      return;
    }

    const controller =
      new AbortController();

    setIsHistoryLoading(true);

    fetchPlayerHistory(
      player.gsisId,
      controller.signal,
    )
      .then((response) => {
        setHistory(response);
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setHistoryError(
          error instanceof Error
            ? error.message
            : "Player history could not be loaded.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsHistoryLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [player.gsisId]);

  /*
   * Closes with Escape and prevents background scrolling.
   */
  useEffect(() => {
    const originalOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    /**
     * Closes the popup when Escape is pressed.
     */
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        originalOverflow;

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [onClose]);

  const draftSeason =
    player.draftSeason ?? 2026;

  const sortedSeasons =
    history
      ? [...history.seasons].sort(
          (firstSeason, secondSeason) =>
            secondSeason.season -
            firstSeason.season,
        )
      : [];

  /**
   * Closes the popup when its backdrop is clicked.
   */
  function handleBackdropClick(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  /**
   * Records the selected player and closes the popup.
   */
  function handleDraftPlayer() {
    onDraftPlayer(player);
    onClose();
  }

  return (
    <div
      className="stats-modal-backdrop"
      onMouseDown={handleBackdropClick}
    >
      <section
        aria-labelledby="draft-player-modal-title"
        aria-modal="true"
        className="stats-player-modal"
        role="dialog"
      >
        <header className="stats-modal-header">
          <div className="stats-modal-player">
            <ModalPlayerHeadshot
              player={player}
            />

            <div>
              <p className="eyebrow">
                {draftSeason} draft profile
              </p>

              <h3 id="draft-player-modal-title">
                {player.name}
              </h3>

              <p>
                {player.position} ·{" "}
                {player.nflTeam} ·{" "}
                {player.position}
                {player.positionRank}
                {player.isRookie
                  ? " · Rookie"
                  : ""}
              </p>
            </div>
          </div>

          <button
            aria-label="Close player profile"
            className="stats-modal-close"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="stats-modal-summary">
          <ModalStatistic
            label="Overall rank"
            value={`#${player.overallRank}`}
          />

          <ModalStatistic
            label="ADP"
            value={formatFantasyNumber(
              player.adp,
            )}
          />

          <ModalStatistic
            label={`${draftSeason} projection`}
            value={formatFantasyNumber(
              player.projectedPoints,
            )}
          />

          <ModalStatistic
            label="Tier"
            value={player.tier}
          />
        </div>

        <div className="stats-modal-category-grid">
          <section className="stats-modal-category">
            <h4>Draft Outlook</h4>

            <div className="stats-modal-stat-grid">
              <ModalStatistic
                label="Position rank"
                value={`${player.position}${player.positionRank}`}
              />

              <ModalStatistic
                label="Rookie rank"
                value={
                  player.rookieRank
                    ? `#${player.rookieRank}`
                    : "—"
                }
              />

              <ModalStatistic
                label="Bye week"
                value={player.byeWeek ?? "—"}
              />

              <ModalStatistic
                label="Ranking source"
                value={
                  player.rankingSource ??
                  "Not available"
                }
              />
            </div>
          </section>

          <section className="stats-modal-category">
            <h4>Projection Context</h4>

            <div className="stats-modal-stat-grid">
              <ModalStatistic
                label="Projection source"
                value={
                  player.projectionSource ??
                  "Not available yet"
                }
              />

              <ModalStatistic
                label="Confidence"
                value={
                  player.projectionConfidence ??
                  "—"
                }
              />

              <ModalStatistic
                label="Injury status"
                value={
                  player.injuryStatus ??
                  "Healthy / unlisted"
                }
              />

              <ModalStatistic
                label="Depth chart"
                value={getDepthChartLabel(
                  player,
                )}
              />
            </div>
          </section>
        </div>

        <section className="stats-modal-history">
          <div className="stats-modal-section-heading">
            <div>
              <p className="eyebrow">
                NFL production
              </p>

              <h4>2022–2025 History</h4>
            </div>

            {history && (
              <span>
                {history.summary.seasonsPlayed}{" "}
                seasons ·{" "}
                {history.summary.totalGames} games
              </span>
            )}
          </div>

          {isHistoryLoading && (
            <div className="stats-modal-status">
              Loading player history…
            </div>
          )}

          {historyError && (
            <div className="stats-modal-status">
              {historyError}
            </div>
          )}

          {!isHistoryLoading &&
            !historyError &&
            !history && (
              <div className="stats-modal-status">
                {getNoHistoryMessage(player)}
              </div>
            )}

          {history && (
            <>
              <div className="stats-modal-career-summary">
                <ModalStatistic
                  label="Career half-PPR"
                  value={
                    history.summary
                      .totalHalfPprPoints
                      .toFixed(1)
                  }
                />

                <ModalStatistic
                  label="Points per game"
                  value={
                    history.summary
                      .averagePointsPerGame
                      .toFixed(1)
                  }
                />

                <ModalStatistic
                  label="Best season"
                  value={
                    history.summary.bestSeason ??
                    "—"
                  }
                />

                <ModalStatistic
                  label="Best-season points"
                  value={
                    history.summary
                      .bestSeasonPoints
                      .toFixed(1)
                  }
                />
              </div>

              <div className="stats-modal-season-list">
                {sortedSeasons.map((season) => (
                  <article key={season.season}>
                    <div className="draft-history-stat">
                      <span>Season</span>
                      <strong>{season.season}</strong>
                    </div>

                    <div className="draft-history-stat">
                      <span>Games</span>
                      <strong>{season.games}</strong>
                    </div>

                    <div className="draft-history-stat">
                      <span>Points</span>
                      <strong>
                        {season.halfPprPoints.toFixed(
                          1,
                        )}
                      </strong>
                    </div>

                    <div className="draft-history-stat">
                      <span>PPG</span>
                      <strong>
                        {season.pointsPerGame.toFixed(
                          1,
                        )}
                      </strong>
                    </div>

                    <div className="draft-history-stat">
                      <span>Pass Yds</span>
                      <strong>
                        {formatWholeNumber(
                          season.passingYards,
                        )}
                      </strong>
                    </div>

                    <div className="draft-history-stat">
                      <span>Rush Yds</span>
                      <strong>
                        {formatWholeNumber(
                          season.rushingYards,
                        )}
                      </strong>
                    </div>

                    <div className="draft-history-stat">
                      <span>Rec Yds</span>
                      <strong>
                        {formatWholeNumber(
                          season.receivingYards,
                        )}
                      </strong>
                    </div>

                    <div className="draft-history-stat">
                      <span>Total TD</span>
                      <strong>
                        {season.totalTouchdowns}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        <div className="draft-modal-actions">
          <button
            className="secondary-button"
            onClick={onClose}
            type="button"
          >
            Close
          </button>

          <button
            className="draft-player-button"
            onClick={handleDraftPlayer}
            type="button"
          >
            {isUserOnClock
              ? "Select Pick"
              : "Record Drafted"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DraftPlayerDetailsModal;
