import type {
  FantasyTeam,
} from "../types";

import {
  getDraftGradingReport,
  type DraftCategoryGrade,
  type DraftGradePick,
  type DraftPickAnalysis,
} from "../utils/draftGrades";

interface DraftReportCardProps {
  picks: DraftGradePick[];
  teams: FantasyTeam[];
}

/**
 * Formats draft-value movement relative to expected pick.
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
 * Displays one scoring category.
 */
function GradeCategory({
  grade,
  label,
}: {
  grade: DraftCategoryGrade;
  label: string;
}) {
  return (
    <div className="mock-grade-category">
      <div>
        <strong>{label}</strong>

        <span>
          #{grade.leagueRank} in league
        </span>
      </div>

      <div className="mock-grade-category-score">
        <strong>
          {grade.score.toFixed(1)}
        </strong>

        <span>
          /{grade.maximumScore}
        </span>
      </div>
    </div>
  );
}

/**
 * Displays a value or reach pick.
 */
function PickAnalysisCard({
  analysis,
  emptyText,
  eyebrow,
}: {
  analysis: DraftPickAnalysis | null;
  emptyText: string;
  eyebrow: string;
}) {
  return (
    <article className="mock-grade-pick-card">
      <p className="eyebrow">
        {eyebrow}
      </p>

      {analysis ? (
        <>
          <strong>
            {analysis.playerName}
          </strong>

          <span>
            {analysis.position} · Pick #
            {analysis.overallPick}
          </span>

          <small>
            Expected around #
            {Math.round(
              analysis.expectedPick,
            )}
          </small>

          <b>
            {formatPickDifference(
              analysis.valueDifference,
            )}
          </b>
        </>
      ) : (
        <span>{emptyText}</span>
      )}
    </article>
  );
}

/**
 * Displays the completed mock-draft grade and
 * league-wide comparison.
 */
function DraftReportCard({
  picks,
  teams,
}: DraftReportCardProps) {
  const report =
    getDraftGradingReport({
      picks,
      teams,
    });

  const userTeam =
    teams.find(
      (team) => team.isUser,
    );

  const userGrade =
    userTeam
      ? report.teams.find(
          (team) =>
            team.fantasyTeamId ===
            userTeam.id,
        )
      : null;

  if (
    !userTeam ||
    !userGrade
  ) {
    return null;
  }

  return (
    <section className="mock-draft-grade-report">
      <header className="mock-grade-report-header">
        <div>
          <p className="eyebrow">
            ThunderDraft report card
          </p>

          <h3>
            Mock Draft Grade
          </h3>

          <span>
            Compared against all{" "}
            {teams.length} completed
            rosters
          </span>
        </div>

        <div className="mock-grade-hero">
          <strong>
            {userGrade.letterGrade}
          </strong>

          <div>
            <b>
              {userGrade.overallScore.toFixed(
                1,
              )}
            </b>

            <span>
              #{userGrade.leagueRank} of{" "}
              {teams.length}
            </span>
          </div>
        </div>
      </header>

      <div className="mock-grade-summary-strip">
        <div>
          <span>League average</span>

          <strong>
            {report.averageScore.toFixed(
              1,
            )}
          </strong>
        </div>

        <div>
          <span>Best league score</span>

          <strong>
            {report.highestScore.toFixed(
              1,
            )}
          </strong>
        </div>

        <div>
          <span>Your best category</span>

          <strong>
            {userGrade.strongestCategory}
          </strong>
        </div>

        <div>
          <span>Needs improvement</span>

          <strong>
            {userGrade.weakestCategory}
          </strong>
        </div>
      </div>

      <div className="mock-grade-main-grid">
        <div className="mock-grade-breakdown-card">
          <div className="mock-grade-section-heading">
            <div>
              <p className="eyebrow">
                Score breakdown
              </p>

              <h4>
                Thunder
              </h4>
            </div>

            <span>
              {userGrade.overallScore.toFixed(
                1,
              )}
              /100
            </span>
          </div>

          <div className="mock-grade-category-list">
            <GradeCategory
              grade={
                userGrade.startingLineup
              }
              label="Starting Lineup"
            />

            <GradeCategory
              grade={
                userGrade.draftValue
              }
              label="Draft Value"
            />

            <GradeCategory
              grade={
                userGrade.rosterConstruction
              }
              label="Roster Construction"
            />

            <GradeCategory
              grade={
                userGrade.benchStrength
              }
              label="Bench Strength"
            />

            <GradeCategory
              grade={
                userGrade.riskManagement
              }
              label="Risk Management"
            />
          </div>
        </div>

        <div className="mock-grade-decisions">
          <PickAnalysisCard
            analysis={
              userGrade.bestValue
            }
            emptyText="No clear value pick."
            eyebrow="Best value"
          />

          <PickAnalysisCard
            analysis={
              userGrade.biggestReach
            }
            emptyText="No meaningful reach."
            eyebrow="Biggest reach"
          />
        </div>
      </div>

      <div className="mock-grade-notes-grid">
        <article>
          <p className="eyebrow">
            Roster strengths
          </p>

          {userGrade.strengths.length >
          0 ? (
            <ul>
              {userGrade.strengths.map(
                (strength) => (
                  <li key={strength}>
                    {strength}
                  </li>
                ),
              )}
            </ul>
          ) : (
            <span>
              No major strengths identified
              yet.
            </span>
          )}
        </article>

        <article>
          <p className="eyebrow">
            Roster concerns
          </p>

          {userGrade.concerns.length >
          0 ? (
            <ul>
              {userGrade.concerns.map(
                (concern) => (
                  <li key={concern}>
                    {concern}
                  </li>
                ),
              )}
            </ul>
          ) : (
            <span>
              No major roster concerns.
            </span>
          )}
        </article>
      </div>

      <div className="mock-league-grade-card">
        <div className="mock-grade-section-heading">
          <div>
            <p className="eyebrow">
              League comparison
            </p>

            <h4>
              Draft Power Rankings
            </h4>
          </div>

          <span>
            {teams.length} teams
          </span>
        </div>

        <div className="mock-league-grade-list">
          {report.teams.map(
            (grade) => {
              const team =
                teams.find(
                  (candidate) =>
                    candidate.id ===
                    grade.fantasyTeamId,
                );

              const teamPicks =
                picks
                  .filter(
                    (pick) =>
                      pick.fantasyTeamId ===
                      grade.fantasyTeamId,
                  )
                  .sort(
                    (
                      first,
                      second,
                    ) =>
                      first.overallPick -
                      second.overallPick,
                  );

              const categories = [
                {
                  label:
                    "Starting Lineup",
                  grade:
                    grade.startingLineup,
                },
                {
                  label:
                    "Draft Value",
                  grade:
                    grade.draftValue,
                },
                {
                  label:
                    "Roster Construction",
                  grade:
                    grade.rosterConstruction,
                },
                {
                  label:
                    "Bench Strength",
                  grade:
                    grade.benchStrength,
                },
                {
                  label:
                    "Risk Management",
                  grade:
                    grade.riskManagement,
                },
              ];

              return (
                <details
                  className={[
                    "mock-league-team-details",
                    team?.isUser
                      ? "mock-user-team-details"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={
                    grade.fantasyTeamId
                  }
                >
                  <summary
                    className={[
                      "mock-league-grade-row",
                      team?.isUser
                        ? "mock-user-grade-row"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="mock-league-rank">
                      #{grade.leagueRank}
                    </span>

                    <span className="mock-league-team-emoji">
                      {team?.emoji ?? "🏈"}
                    </span>

                    <div className="mock-league-team-name">
                      <strong>
                        {grade.teamName}
                        {team?.isUser
                          ? " — You"
                          : ""}
                      </strong>

                      <small>
                        Best:{" "}
                        {
                          grade.strongestCategory
                        }
                      </small>
                    </div>

                    <strong className="mock-league-letter-grade">
                      {grade.letterGrade}
                    </strong>

                    <span className="mock-league-score">
                      {grade.overallScore.toFixed(
                        1,
                      )}
                    </span>

                    <span
                      aria-hidden="true"
                      className="mock-league-expand-icon"
                    >
                      ▼
                    </span>
                  </summary>

                  <div className="mock-league-expanded-team">
                    <div className="mock-expanded-grade-summary">
                      {categories.map(
                        (category) => (
                          <div
                            className="mock-expanded-grade-category"
                            key={
                              category.label
                            }
                          >
                            <span>
                              {
                                category.label
                              }
                            </span>

                            <strong>
                              {category.grade.score.toFixed(
                                1,
                              )}
                              /
                              {
                                category.grade.maximumScore
                              }
                            </strong>

                            <small>
                              #
                              {
                                category.grade.leagueRank
                              }{" "}
                              in league
                            </small>
                          </div>
                        ),
                      )}
                    </div>

                    <div className="mock-expanded-team-notes">
                      <div>
                        <p className="eyebrow">
                          Best Value
                        </p>

                        {grade.bestValue ? (
                          <>
                            <strong>
                              {
                                grade.bestValue.playerName
                              }
                            </strong>

                            <span>
                              Pick #
                              {
                                grade.bestValue.overallPick
                              }{" "}
                              · +
                              {Math.round(
                                grade.bestValue.valueDifference,
                              )}{" "}
                              picks
                            </span>
                          </>
                        ) : (
                          <span>
                            No clear value pick
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="eyebrow">
                          Biggest Reach
                        </p>

                        {grade.biggestReach ? (
                          <>
                            <strong>
                              {
                                grade.biggestReach.playerName
                              }
                            </strong>

                            <span>
                              Pick #
                              {
                                grade.biggestReach.overallPick
                              }{" "}
                              ·{" "}
                              {Math.round(
                                grade.biggestReach.valueDifference,
                              )}{" "}
                              picks
                            </span>
                          </>
                        ) : (
                          <span>
                            No meaningful reach
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mock-expanded-roster">
                      <div className="mock-expanded-roster-heading">
                        <div>
                          <p className="eyebrow">
                            Full roster
                          </p>

                          <strong>
                            {
                              grade.teamName
                            }
                          </strong>
                        </div>

                        <span>
                          {
                            teamPicks.length
                          }{" "}
                          players
                        </span>
                      </div>

                      <div className="mock-expanded-roster-table-wrap">
                        <table className="mock-expanded-roster-table">
                          <thead>
                            <tr>
                              <th>
                                Rd
                              </th>

                              <th>
                                Pick
                              </th>

                              <th>
                                Player
                              </th>

                              <th>
                                Pos
                              </th>

                              <th>
                                NFL
                              </th>

                              <th>
                                Rank
                              </th>

                              <th>
                                ADP
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {teamPicks.map(
                              (pick) => (
                                <tr
                                  key={
                                    pick.id
                                  }
                                >
                                  <td>
                                    {Math.ceil(
                                      pick.overallPick /
                                        teams.length,
                                    )}
                                  </td>

                                  <td>
                                    #
                                    {
                                      pick.overallPick
                                    }
                                  </td>

                                  <td>
                                    <strong>
                                      {
                                        pick.player.name
                                      }
                                    </strong>
                                  </td>

                                  <td>
                                    {
                                      pick.player.position
                                    }
                                    {
                                      pick.player.positionRank
                                    }
                                  </td>

                                  <td>
                                    {
                                      pick.player.nflTeam
                                    }
                                  </td>

                                  <td>
                                    #
                                    {
                                      pick.player.overallRank
                                    }
                                  </td>

                                  <td>
                                    {pick.player.adp ===
                                    null
                                      ? "—"
                                      : Math.round(
                                          pick.player.adp,
                                        )}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {(grade.strengths.length >
                      0 ||
                      grade.concerns.length >
                        0) && (
                      <div className="mock-expanded-analysis">
                        <div>
                          <p className="eyebrow">
                            Strengths
                          </p>

                          {grade.strengths.length >
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
                            <span>
                              None identified
                            </span>
                          )}
                        </div>

                        <div>
                          <p className="eyebrow">
                            Concerns
                          </p>

                          {grade.concerns.length >
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
                            <span>
                              None identified
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}

export default DraftReportCard;
