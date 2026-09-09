import {
  useEffect,
  type MouseEvent,
} from "react";

import type {
  FantasyTeam,
  Player,
  Position,
} from "../types";

import {
  getDraftGradingReport,
  type DraftPickAnalysis,
} from "../utils/draftGrades";


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


const reportCategoryLabels = [
  {
    key: "startingLineup",
    label: "Starting Lineup",
  },
  {
    key: "draftValue",
    label: "Draft Value",
  },
  {
    key: "rosterConstruction",
    label: "Roster Construction",
  },
  {
    key: "benchStrength",
    label: "Bench Strength",
  },
  {
    key: "riskManagement",
    label: "Risk Management",
  },
] as const;


/**
 * Formats draft-value movement relative to expected selection.
 */
function formatPickDifference(
  value: number,
): string {
  const rounded =
    Math.round(value);

  if (rounded > 0) {
    return `+${rounded} picks`;
  }

  if (rounded < 0) {
    return `${rounded} picks`;
  }

  return "At expected value";
}


/**
 * Displays one concise pick-value result.
 */
function PickValueSummary({
  analysis,
  emptyText,
  label,
}: {
  analysis: DraftPickAnalysis | null;
  emptyText: string;
  label: string;
}) {
  return (
    <div className="draft-pdf-value-card">
      <span>{label}</span>

      {analysis ? (
        <>
          <strong>
            {analysis.playerName}
          </strong>

          <small>
            {analysis.position} · Pick #
            {analysis.overallPick} ·{" "}
            {formatPickDifference(
              analysis.valueDifference,
            )}
          </small>
        </>
      ) : (
        <small>{emptyText}</small>
      )}
    </div>
  );
}


/**
 * Counts one completed roster by position.
 */
function getPositionCounts(
  teamPicks: DraftResultPick[],
): Record<Position, number> {
  const counts: Record<
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

  teamPicks.forEach((pick) => {
    counts[pick.player.position] +=
      1;
  });

  return counts;
}


/**
 * Displays every completed roster and generates
 * the printable league-wide ThunderDraft report.
 */
function DraftResultsModal({
  draftOrder,
  onClose,
  picks,
  teams,
  totalRounds,
}: DraftResultsModalProps) {
  const report =
    getDraftGradingReport({
      picks,
      teams,
    });

  const hasCompleteDraftOrder =
    draftOrder.length === teams.length &&
    new Set(draftOrder).size ===
      teams.length;

  const gradeByTeamId =
    new Map(
      report.teams.map(
        (grade) => [
          grade.fantasyTeamId,
          grade,
        ],
      ),
    );

  const userTeam =
    teams.find(
      (team) => team.isUser,
    );

  /*
   * Thunder prints first after the league summary.
   * Every other team follows the report's power ranking.
   */
  const rankedTeams =
    [...report.teams]
      .sort(
        (first, second) =>
          first.leagueRank -
          second.leagueRank,
      )
      .map((grade) =>
        teams.find(
          (team) =>
            team.id ===
            grade.fantasyTeamId,
        ),
      )
      .filter(
        (
          team,
        ): team is FantasyTeam =>
          team !== undefined,
      );

  const orderedTeams = [
    ...(userTeam
      ? [userTeam]
      : []),
    ...rankedTeams.filter(
      (team) =>
        team.id !== userTeam?.id,
    ),
  ];

  const getCategoryLeader = (
    key:
      | "startingLineup"
      | "draftValue"
      | "rosterConstruction"
      | "benchStrength"
      | "riskManagement",
  ) =>
    [...report.teams].sort(
      (first, second) =>
        second[key].percentage -
        first[key].percentage ||
        first.leagueRank -
        second.leagueRank,
    )[0];

  const overallLeader =
    [...report.teams].sort(
      (first, second) =>
        first.leagueRank -
        second.leagueRank,
    )[0];

  const lineupLeader =
    getCategoryLeader(
      "startingLineup",
    );

  const benchLeader =
    getCategoryLeader(
      "benchStrength",
    );

  const constructionLeader =
    getCategoryLeader(
      "rosterConstruction",
    );

  const valueLeader =
    getCategoryLeader(
      "draftValue",
    );

  const bestLeagueValue =
    [...report.teams]
      .map((grade) => ({
        grade,
        analysis:
          grade.bestValue,
      }))
      .filter(
        (
          result,
        ): result is {
          grade:
            (typeof report.teams)[number];
          analysis: DraftPickAnalysis;
        } =>
          result.analysis !== null,
      )
      .sort(
        (first, second) =>
          second.analysis
            .valueDifference -
          first.analysis
            .valueDifference,
      )[0];

  /*
   * Closes with Escape and prevents background scrolling.
   */
  useEffect(() => {
    const originalOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

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
    if (
      event.target ===
      event.currentTarget
    ) {
      onClose();
    }
  }


  /**
   * Uses the browser print engine so Chrome can
   * save the completed report directly as PDF.
   */
  function savePdf() {
    const previousTitle =
      document.title;

    document.title =
      "ThunderDraft-2026-Draft-Report";

    window.print();

    document.title =
      previousTitle;
  }


  return (
    <div
      className="stats-modal-backdrop draft-results-backdrop"
      onMouseDown={
        handleBackdropClick
      }
    >
      <section
        aria-labelledby="draft-results-title"
        aria-modal="true"
        className="stats-player-modal draft-results-modal"
        role="dialog"
      >
        <header className="stats-modal-header draft-pdf-main-header">
          <div className="draft-results-header-copy">
            <p className="eyebrow">
              Completed draft
            </p>

            <h2 id="draft-results-title">
              ThunderDraft 2026
              Draft Report
            </h2>

            <span className="draft-results-summary">
              {teams.length} teams ·{" "}
              {picks.length} picks ·{" "}
              {totalRounds} rounds ·
              Half-PPR
            </span>
          </div>

          <div className="draft-pdf-actions">
            <button
              className="primary-button compact-button"
              onClick={savePdf}
              type="button"
            >
              Save PDF
            </button>

            <button
              className="secondary-button compact-button"
              onClick={onClose}
              type="button"
            >
              Close
            </button>
          </div>
        </header>

        <div className="draft-results-content">
          <section className="draft-report-league-summary">
            <div className="draft-report-summary-heading">
              <div>
                <p className="eyebrow">
                  League report
                </p>

                <h3>
                  Draft Summary
                </h3>
              </div>

              <span>
                Generated by ThunderDraft
              </span>
            </div>

            <div className="draft-report-summary-grid">
              <div>
                <span>
                  League average
                </span>

                <strong>
                  {report.averageScore.toFixed(
                    1,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Top draft
                </span>

                <strong>
                  {overallLeader?.teamName ??
                    "—"}
                </strong>

                <small>
                  {overallLeader
                    ? `${overallLeader.letterGrade} · ${overallLeader.overallScore.toFixed(1)}`
                    : "—"}
                </small>
              </div>

              <div>
                <span>
                  Best starting lineup
                </span>

                <strong>
                  {lineupLeader?.teamName ??
                    "—"}
                </strong>

                <small>
                  {lineupLeader
                    ? `${lineupLeader.startingLineup.percentage.toFixed(1)}%`
                    : "—"}
                </small>
              </div>

              <div>
                <span>
                  Best bench
                </span>

                <strong>
                  {benchLeader?.teamName ??
                    "—"}
                </strong>

                <small>
                  {benchLeader
                    ? `${benchLeader.benchStrength.percentage.toFixed(1)}%`
                    : "—"}
                </small>
              </div>

              <div>
                <span>
                  Best construction
                </span>

                <strong>
                  {constructionLeader?.teamName ??
                    "—"}
                </strong>

                <small>
                  {constructionLeader
                    ? `${constructionLeader.rosterConstruction.percentage.toFixed(1)}%`
                    : "—"}
                </small>
              </div>

              <div>
                <span>
                  Best draft value
                </span>

                <strong>
                  {valueLeader?.teamName ??
                    "—"}
                </strong>

                <small>
                  {valueLeader
                    ? `${valueLeader.draftValue.percentage.toFixed(1)}%`
                    : "—"}
                </small>
              </div>
            </div>

            {bestLeagueValue && (
              <div className="draft-report-league-value">
                <span>
                  Best individual value
                </span>

                <strong>
                  {
                    bestLeagueValue
                      .analysis
                      .playerName
                  }
                </strong>

                <small>
                  {
                    bestLeagueValue
                      .grade
                      .teamName
                  }{" "}
                  · Pick #
                  {
                    bestLeagueValue
                      .analysis
                      .overallPick
                  }{" "}
                  ·{" "}
                  {formatPickDifference(
                    bestLeagueValue
                      .analysis
                      .valueDifference,
                  )}
                </small>
              </div>
            )}

            <div className="draft-report-power-section">
              <div className="draft-report-section-heading">
                <div>
                  <p className="eyebrow">
                    League comparison
                  </p>

                  <h3>
                    Draft Power Rankings
                  </h3>
                </div>
              </div>

              <div className="draft-report-power-list">
                {[...report.teams]
                  .sort(
                    (
                      first,
                      second,
                    ) =>
                      first.leagueRank -
                      second.leagueRank,
                  )
                  .map((grade) => {
                    const team =
                      teams.find(
                        (candidate) =>
                          candidate.id ===
                          grade.fantasyTeamId,
                      );

                    return (
                      <div
                        className={[
                          "draft-report-power-row",
                          team?.isUser
                            ? "draft-report-user-power-row"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        key={
                          grade.fantasyTeamId
                        }
                      >
                        <strong>
                          #{grade.leagueRank}
                        </strong>

                        <span>
                          {team?.emoji ??
                            "🏈"}
                        </span>

                        <div>
                          <b>
                            {grade.teamName}
                            {team?.isUser
                              ? " — You"
                              : ""}
                          </b>

                          <small>
                            Best:{" "}
                            {
                              grade.strongestCategory
                            }
                          </small>
                        </div>

                        <b>
                          {
                            grade.letterGrade
                          }
                        </b>

                        <strong>
                          {grade.overallScore.toFixed(
                            1,
                          )}
                        </strong>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>

          {orderedTeams.map(
            (team) => {
              const teamPicks =
                picks
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

              const grade =
                gradeByTeamId.get(
                  team.id,
                );

              const positionCounts =
                getPositionCounts(
                  teamPicks,
                );

              const draftSlot =
                hasCompleteDraftOrder
                  ? draftOrder.indexOf(
                      team.id,
                    ) + 1
                  : null;

              /*
               * Avoid spotlighting K/DST reach calculations
               * in the final report until special-team
               * grading is calibrated separately.
               */
              const meaningfulReach =
                grade?.biggestReach &&
                ![
                  "K",
                  "DST",
                ].includes(
                  grade.biggestReach
                    .position,
                )
                  ? grade.biggestReach
                  : null;

              return (
                <section
                  className={[
                    "draft-results-team",
                    "draft-pdf-team-page",
                    team.isUser
                      ? "user-draft-results-team"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={team.id}
                >
                  <header className="draft-results-team-header draft-pdf-team-header">
                    <div className="draft-results-team-identity">
                      <span
                        aria-hidden="true"
                      >
                        {team.emoji}
                      </span>

                      <div>
                        <p className="eyebrow">
                          Team draft report
                        </p>

                        <strong>
                          {team.name}
                          {team.isUser
                            ? " — You"
                            : ""}
                        </strong>

                        <small>
                          {draftSlot
                            ? `Draft slot ${draftSlot}`
                            : "League team"}
                          {" · "}
                          {
                            teamPicks.length
                          }
                          /
                          {totalRounds}{" "}
                          picks
                        </small>
                      </div>
                    </div>

                    {grade && (
                      <div className="draft-pdf-team-grade">
                        <strong>
                          {
                            grade.letterGrade
                          }
                        </strong>

                        <div>
                          <b>
                            {grade.overallScore.toFixed(
                              1,
                            )}
                          </b>

                          <span>
                            #
                            {
                              grade.leagueRank
                            }{" "}
                            of{" "}
                            {
                              teams.length
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </header>

                  <div className="draft-pdf-position-build">
                    {(
                      [
                        "QB",
                        "RB",
                        "WR",
                        "TE",
                        "K",
                        "DST",
                      ] as Position[]
                    ).map(
                      (position) => (
                        <div
                          key={
                            position
                          }
                        >
                          <span>
                            {position}
                          </span>

                          <strong>
                            {
                              positionCounts[
                                position
                              ]
                            }
                          </strong>
                        </div>
                      ),
                    )}
                  </div>

                  {grade && (
                    <>
                      <div className="draft-pdf-category-grid">
                        {reportCategoryLabels.map(
                          (
                            category,
                          ) => {
                            const categoryGrade =
                              grade[
                                category.key
                              ];

                            return (
                              <div
                                key={
                                  category.key
                                }
                              >
                                <span>
                                  {
                                    category.label
                                  }
                                </span>

                                <strong>
                                  {categoryGrade.score.toFixed(
                                    1,
                                  )}
                                  /
                                  {
                                    categoryGrade.maximumScore
                                  }
                                </strong>

                                <small>
                                  #
                                  {
                                    categoryGrade.leagueRank
                                  }{" "}
                                  in league
                                </small>
                              </div>
                            );
                          },
                        )}
                      </div>

                      <div className="draft-pdf-value-grid">
                        <PickValueSummary
                          analysis={
                            grade.bestValue
                          }
                          emptyText="No clear value pick."
                          label="Best value"
                        />

                        <PickValueSummary
                          analysis={
                            meaningfulReach
                          }
                          emptyText="No meaningful skill-position reach."
                          label="Biggest reach"
                        />
                      </div>

                      <div className="draft-pdf-analysis-grid">
                        <div>
                          <span>
                            Strengths
                          </span>

                          {grade.strengths
                            .length >
                          0 ? (
                            <ul>
                              {grade.strengths.map(
                                (
                                  strength,
                                ) => (
                                  <li
                                    key={
                                      strength
                                    }
                                  >
                                    {
                                      strength
                                    }
                                  </li>
                                ),
                              )}
                            </ul>
                          ) : (
                            <small>
                              No major
                              strengths
                              identified.
                            </small>
                          )}
                        </div>

                        <div>
                          <span>
                            Concerns
                          </span>

                          {grade.concerns
                            .length >
                          0 ? (
                            <ul>
                              {grade.concerns.map(
                                (
                                  concern,
                                ) => (
                                  <li
                                    key={
                                      concern
                                    }
                                  >
                                    {
                                      concern
                                    }
                                  </li>
                                ),
                              )}
                            </ul>
                          ) : (
                            <small>
                              No major
                              roster
                              concerns.
                            </small>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="draft-results-table-wrap">
                    <table className="draft-results-table draft-pdf-roster-table">
                      <thead>
                        <tr>
                          <th scope="col">
                            Rd
                          </th>

                          <th scope="col">
                            Pick
                          </th>

                          <th scope="col">
                            Player
                          </th>

                          <th scope="col">
                            Pos
                          </th>

                          <th scope="col">
                            NFL
                          </th>

                          <th scope="col">
                            Rank
                          </th>

                          <th scope="col">
                            ADP
                          </th>

                          <th scope="col">
                            Proj
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {teamPicks.map(
                          (pick) => {
                            const round =
                              Math.ceil(
                                pick.overallPick /
                                  teams.length,
                              );

                            return (
                              <tr
                                key={
                                  pick.id
                                }
                              >
                                <td>
                                  {round}
                                </td>

                                <td>
                                  #
                                  {
                                    pick.overallPick
                                  }
                                </td>

                                <td className="draft-results-player-cell">
                                  <strong>
                                    {
                                      pick
                                        .player
                                        .name
                                    }
                                  </strong>

                                  <span>
                                    {
                                      pick
                                        .player
                                        .position
                                    }
                                    {
                                      pick
                                        .player
                                        .positionRank
                                    }
                                  </span>
                                </td>

                                <td>
                                  {
                                    pick
                                      .player
                                      .position
                                  }
                                  {
                                    pick
                                      .player
                                      .positionRank
                                  }
                                </td>

                                <td>
                                  {
                                    pick
                                      .player
                                      .nflTeam
                                  }
                                </td>

                                <td>
                                  #
                                  {
                                    pick
                                      .player
                                      .overallRank
                                  }
                                </td>

                                <td>
                                  {pick
                                    .player
                                    .adp ===
                                  null
                                    ? "—"
                                    : pick.player.adp.toFixed(
                                        1,
                                      )}
                                </td>

                                <td>
                                  {pick
                                    .player
                                    .projectedPoints ===
                                  null
                                    ? "—"
                                    : pick.player.projectedPoints.toFixed(
                                        1,
                                      )}
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            },
          )}
        </div>

        <div className="draft-modal-actions draft-pdf-actions">
          <button
            className="primary-button"
            onClick={savePdf}
            type="button"
          >
            Save PDF
          </button>

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
