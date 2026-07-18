import {
  useEffect,
  type MouseEvent,
} from "react";

import type {
  FantasyTeam,
  Player,
} from "../types";


interface DraftResultPick {
  id: string;
  overallPick: number;
  fantasyTeamId: string;
  player: Player;
}


interface DraftResultsModalProps {
  draftOrder: string[];
  onClose: () => void;
  picks: DraftResultPick[];
  teams: FantasyTeam[];
  totalRounds: number;
}


/**
 * Displays every completed roster in draft-order sequence.
 */
function DraftResultsModal({
  draftOrder,
  onClose,
  picks,
  teams,
  totalRounds,
}: DraftResultsModalProps) {
  const hasCompleteDraftOrder =
    draftOrder.length === teams.length &&
    new Set(draftOrder).size ===
      teams.length;

  const orderedTeams = hasCompleteDraftOrder
    ? draftOrder
        .map((teamId) =>
          teams.find(
            (team) => team.id === teamId,
          ),
        )
        .filter(
          (
            team,
          ): team is FantasyTeam =>
            team !== undefined,
        )
    : teams;

  /*
   * Closes with Escape and prevents background scrolling.
   */
  useEffect(() => {
    const originalOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    /**
     * Closes the results popup with Escape.
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

  /**
   * Closes the popup when the backdrop is selected.
   */
  function handleBackdropClick(
    event: MouseEvent<HTMLDivElement>,
  ) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="stats-modal-backdrop"
      onMouseDown={handleBackdropClick}
    >
      <section
        aria-labelledby="draft-results-title"
        aria-modal="true"
        className="stats-player-modal draft-results-modal"
        role="dialog"
      >
        <header className="stats-modal-header">
          <div className="draft-results-header-copy">
            <p className="eyebrow">
              Completed draft
            </p>

            <h2 id="draft-results-title">
              Draft Results
            </h2>

            <span className="draft-results-summary">
              {teams.length} teams ·{" "}
              {picks.length} picks ·{" "}
              {totalRounds} rounds
            </span>
          </div>

          <button
            className="secondary-button compact-button"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="draft-results-content">
          {orderedTeams.map(
            (team, teamIndex) => {
              const teamPicks = picks
                .filter(
                  (pick) =>
                    pick.fantasyTeamId ===
                    team.id,
                )
                .sort(
                  (
                    firstPick,
                    secondPick,
                  ) =>
                    firstPick.overallPick -
                    secondPick.overallPick,
                );

              return (
                <section
                  className={`draft-results-team ${
                    team.isUser
                      ? "user-draft-results-team"
                      : ""
                  }`}
                  key={team.id}
                >
                  <header className="draft-results-team-header">
                    <div className="draft-results-team-identity">
                      <span aria-hidden="true">
                        {team.emoji}
                      </span>

                      <div>
                        <strong>
                          {team.name}
                          {team.isUser
                            ? " — You"
                            : ""}
                        </strong>

                        <small>
                          {hasCompleteDraftOrder
                            ? `Draft slot ${teamIndex + 1}`
                            : "League team"}
                        </small>
                      </div>
                    </div>

                    <span>
                      {teamPicks.length}/
                      {totalRounds} picks
                    </span>
                  </header>

                  <div className="draft-results-table-wrap">
                    <table className="draft-results-table">
                      <thead>
                        <tr>
                          <th scope="col">
                            Round
                          </th>

                          <th scope="col">
                            Overall
                          </th>

                          <th scope="col">
                            Player
                          </th>

                          <th scope="col">
                            Pos.
                          </th>

                          <th scope="col">
                            NFL
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {teamPicks.map((pick) => {
                          const round =
                            Math.ceil(
                              pick.overallPick /
                                teams.length,
                            );

                          return (
                            <tr key={pick.id}>
                              <td>
                                {round}
                              </td>

                              <td>
                                {pick.overallPick}
                              </td>

                              <td className="draft-results-player-cell">
                                <strong>
                                  {pick.player.name}
                                </strong>

                                <span>
                                  {pick.player.position}
                                  {pick.player.positionRank}
                                </span>
                              </td>

                              <td>
                                {pick.player.position}
                              </td>

                              <td>
                                {pick.player.nflTeam}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            },
          )}
        </div>

        <div className="draft-modal-actions">
          <button
            className="secondary-button"
            onClick={onClose}
            type="button"
          >
            Close Results
          </button>
        </div>
      </section>
    </div>
  );
}


export default DraftResultsModal;
