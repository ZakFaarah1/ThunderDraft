import { useEffect, useState } from "react";

import { fantasyTeams } from "../data/league";
import { demoPlayers } from "../data/players";

import type {
  Player,
  Position,
} from "../types";

import {
  getFantasyTeamForPick,
  getPicksUntilNextTurn,
  getUserOverallPicks,
} from "../utils/draft";

import {
  getRosterHealthReport,
  type RosterHealthLevel,
  type RosterHealthReport,
} from "../utils/rosterHealth";

import DraftOrderSetup from "./DraftOrderSetup";
import MyRoster from "./MyRoster";
import PlayerBoard from "./PlayerBoard";
import RecommendationsPanel from "./RecommendationsPanel";

interface RecordedDraftPick {
  id: string;
  overallPick: number;
  fantasyTeamId: string;
  player: Player;
}

const draftOrderStorageKey =
  "thunderdraft-draft-order";

const draftPicksStorageKey =
  "thunderdraft-draft-picks";

const totalDraftRounds = 15;

/*
 * Controls the display order for roster position counts.
 */
const rosterPositionOrder: Position[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

/**
 * Converts a roster-health level into a user-facing label.
 */
function getRosterHealthLabel(
  level: RosterHealthLevel,
): string {
  if (level === "strong") {
    return "Strong";
  }

  if (level === "watch") {
    return "Needs attention";
  }

  return "Weak";
}

/**
 * Creates a short explanation of the current roster-health status.
 */
function getRosterHealthSummary(
  report: RosterHealthReport,
): string {
  if (report.issues.length === 0) {
    return "Your roster has no urgent weaknesses right now.";
  }

  if (report.level === "strong") {
    return "Your roster is balanced, with only minor needs remaining.";
  }

  if (report.level === "watch") {
    return "Your core is competitive, but one or more positions need attention.";
  }

  return "Address the most urgent weakness before adding luxury depth.";
}

/**
 * Loads and validates the saved draft order.
 */
function loadSavedDraftOrder(): string[] {
  try {
    const savedOrder = localStorage.getItem(
      draftOrderStorageKey,
    );

    if (!savedOrder) {
      return [];
    }

    const parsedOrder: unknown =
      JSON.parse(savedOrder);

    if (
      !Array.isArray(parsedOrder) ||
      parsedOrder.length !== fantasyTeams.length
    ) {
      return [];
    }

    const validTeamIds = new Set(
      fantasyTeams.map((team) => team.id),
    );

    const allTeamsAreValid = parsedOrder.every(
      (teamId) =>
        typeof teamId === "string" &&
        validTeamIds.has(teamId),
    );

    const containsEveryTeam =
      new Set(parsedOrder).size ===
      fantasyTeams.length;

    if (!allTeamsAreValid || !containsEveryTeam) {
      return [];
    }

    return parsedOrder;
  } catch {
    return [];
  }
}

/**
 * Loads and validates the saved draft picks.
 */
function loadSavedDraftPicks(): RecordedDraftPick[] {
  try {
    const savedPicks = localStorage.getItem(
      draftPicksStorageKey,
    );

    if (!savedPicks) {
      return [];
    }

    const parsedPicks: unknown =
      JSON.parse(savedPicks);

    if (!Array.isArray(parsedPicks)) {
      return [];
    }

    const validTeamIds = new Set(
      fantasyTeams.map((team) => team.id),
    );

    const picksAreValid = parsedPicks.every(
      (pick) => {
        if (
          typeof pick !== "object" ||
          pick === null ||
          !("id" in pick) ||
          !("overallPick" in pick) ||
          !("fantasyTeamId" in pick) ||
          !("player" in pick)
        ) {
          return false;
        }

        const savedPick =
          pick as Partial<RecordedDraftPick>;

        return (
          typeof savedPick.id === "string" &&
          typeof savedPick.overallPick ===
            "number" &&
          Number.isInteger(
            savedPick.overallPick,
          ) &&
          savedPick.overallPick > 0 &&
          typeof savedPick.fantasyTeamId ===
            "string" &&
          validTeamIds.has(
            savedPick.fantasyTeamId,
          ) &&
          typeof savedPick.player === "object" &&
          savedPick.player !== null &&
          typeof savedPick.player.id ===
            "string" &&
          typeof savedPick.player.name ===
            "string" &&
          typeof savedPick.player.position ===
            "string"
        );
      },
    );

    if (!picksAreValid) {
      return [];
    }

    return parsedPicks as RecordedDraftPick[];
  } catch {
    return [];
  }
}

/**
 * Displays and controls the live fantasy draft.
 */
function DraftRoom() {
  const [draftPicks, setDraftPicks] = useState<
    RecordedDraftPick[]
  >(loadSavedDraftPicks);

  const [draftOrder, setDraftOrder] =
    useState<string[]>(loadSavedDraftOrder);

  const [
    showDraftOrderSetup,
    setShowDraftOrderSetup,
  ] = useState(false);

  const [
    manualFantasyTeamId,
    setManualFantasyTeamId,
  ] = useState(fantasyTeams[0].id);

  /*
   * Saves draft selections whenever the recorded picks change.
   */
  useEffect(() => {
    localStorage.setItem(
      draftPicksStorageKey,
      JSON.stringify(draftPicks),
    );
  }, [draftPicks]);

  const nextOverallPick =
    draftPicks.length + 1;

  const hasDraftOrder =
    draftOrder.length === fantasyTeams.length &&
    new Set(draftOrder).size ===
      fantasyTeams.length;

  const currentDraftSlot = hasDraftOrder
    ? getFantasyTeamForPick(
        nextOverallPick,
        fantasyTeams.length,
        "snake",
      )
    : null;

  const activeFantasyTeamId =
    currentDraftSlot !== null
      ? draftOrder[currentDraftSlot - 1]
      : manualFantasyTeamId;

  const activeFantasyTeam = fantasyTeams.find(
    (team) =>
      team.id === activeFantasyTeamId,
  );

  const isUserOnClock =
    activeFantasyTeam?.isUser === true;

  const draftedPlayerIds = draftPicks.map(
    (pick) => pick.player.id,
  );

  const availablePlayers = demoPlayers.filter(
    (player) =>
      !draftedPlayerIds.includes(player.id),
  );

  const userFantasyTeamId =
    fantasyTeams.find(
      (team) => team.isUser,
    )?.id;

  const userDraftSlot =
    hasDraftOrder && userFantasyTeamId
      ? draftOrder.indexOf(
          userFantasyTeamId,
        ) + 1
      : null;

  const userOverallPicks =
    userDraftSlot !== null &&
    userDraftSlot > 0
      ? getUserOverallPicks(
          userDraftSlot,
          fantasyTeams.length,
          totalDraftRounds,
          "snake",
        )
      : [];

  const picksUntilNextTurn =
    isUserOnClock &&
    userOverallPicks.length > 0
      ? getPicksUntilNextTurn(
          nextOverallPick,
          userOverallPicks,
        )
      : null;

  const userDraftedPlayers = draftPicks
    .filter(
      (pick) =>
        pick.fantasyTeamId ===
        userFantasyTeamId,
    )
    .map((pick) => pick.player);

  /*
   * Recalculates roster health whenever the user's
   * drafted players change.
   */
  const rosterHealthReport =
    getRosterHealthReport(
      userDraftedPlayers,
    );

  const mostUrgentRosterIssue =
    rosterHealthReport.issues[0] ?? null;

  /*
   * Provides the latest six picks for positional-run analysis.
   */
  const recentDraftedPlayers = draftPicks
    .slice(-6)
    .map((pick) => pick.player);

  /**
   * Saves the league's selected draft order.
   */
  function saveDraftOrder(
    teamIds: string[],
  ) {
    setDraftOrder(teamIds);

    localStorage.setItem(
      draftOrderStorageKey,
      JSON.stringify(teamIds),
    );

    setShowDraftOrderSetup(false);
  }

  /**
   * Records a player for the team currently on the clock.
   */
  function draftPlayer(player: Player) {
    const newPick: RecordedDraftPick = {
      id: `${Date.now()}-${player.id}`,
      overallPick: nextOverallPick,
      fantasyTeamId: activeFantasyTeamId,
      player,
    };

    setDraftPicks((currentPicks) => [
      ...currentPicks,
      newPick,
    ]);
  }

  /**
   * Removes the most recent draft pick.
   */
  function undoLastPick() {
    setDraftPicks((currentPicks) =>
      currentPicks.slice(0, -1),
    );
  }

  /**
   * Clears all picks while keeping the selected draft order.
   */
  function resetDraft() {
    const confirmed = window.confirm(
      "Reset all recorded picks? Your saved draft order will remain.",
    );

    if (!confirmed) {
      return;
    }

    setDraftPicks([]);

    localStorage.removeItem(
      draftPicksStorageKey,
    );
  }

  return (
    <section
      className={`draft-room ${
        isUserOnClock
          ? "user-on-clock"
          : ""
      }`}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            Live draft control
          </p>

          <h2>Draft Room</h2>
        </div>

        <div className="draft-room-actions">
          <button
            className="secondary-button compact-button"
            onClick={() =>
              setShowDraftOrderSetup(
                (currentValue) =>
                  !currentValue,
              )
            }
            type="button"
          >
            {showDraftOrderSetup
              ? "Close Order Setup"
              : hasDraftOrder
                ? "Edit Draft Order"
                : "Set Draft Order"}
          </button>

          <span className="current-pick-badge">
            Pick {nextOverallPick}
          </span>

          <button
            className="secondary-button compact-button reset-draft-button"
            disabled={
              draftPicks.length === 0
            }
            onClick={resetDraft}
            type="button"
          >
            Reset Draft
          </button>

          <button
            className="secondary-button compact-button"
            disabled={
              draftPicks.length === 0
            }
            onClick={undoLastPick}
            type="button"
          >
            Undo Last Pick
          </button>
        </div>
      </div>

      {showDraftOrderSetup && (
        <DraftOrderSetup
          initialOrder={draftOrder}
          onSave={saveDraftOrder}
        />
      )}

      <div className="on-clock-card">
        <div className="on-clock-manager">
          <span className="on-clock-emoji">
            {activeFantasyTeam?.emoji ??
              "🏈"}
          </span>

          <div>
            <p className="eyebrow">
              {hasDraftOrder
                ? "Currently on the clock"
                : "Currently recording for"}
            </p>

            <strong>
              {activeFantasyTeam?.name ??
                "Unknown manager"}
            </strong>
          </div>
        </div>

        {hasDraftOrder ? (
          <div className="automatic-order-status">
            <span>
              Automatic snake order
            </span>

            <strong>
              Draft slot{" "}
              {currentDraftSlot} · Pick{" "}
              {nextOverallPick}
            </strong>
          </div>
        ) : (
          <label className="field-group manager-picker">
            <span>
              Select league member
            </span>

            <select
              onChange={(event) =>
                setManualFantasyTeamId(
                  event.target.value,
                )
              }
              value={manualFantasyTeamId}
            >
              {fantasyTeams.map((team) => (
                <option
                  key={team.id}
                  value={team.id}
                >
                  {team.emoji} {team.name}
                  {team.isUser
                    ? " — You"
                    : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {isUserOnClock && (
        <div className="your-turn-banner">
          <div className="your-turn-message">
            <span className="your-turn-pulse" />

            <div>
              <p className="eyebrow">
                You are on the clock
              </p>

              <strong>
                Thunder ⚡ — build your team
              </strong>
            </div>
          </div>

          <span>
            {picksUntilNextTurn === null
              ? "Recommendations are ready"
              : `${picksUntilNextTurn} picks until your next turn`}
          </span>
        </div>
      )}

      {isUserOnClock && (
        <RecommendationsPanel
          availablePlayers={
            availablePlayers
          }
          currentOverallPick={
            nextOverallPick
          }
          picksUntilNextTurn={
            picksUntilNextTurn
          }
          recentDraftedPlayers={
            recentDraftedPlayers
          }
          userDraftedPlayers={
            userDraftedPlayers
          }
          onDraftPlayer={draftPlayer}
        />
      )}

      <div className="draft-room-layout">
        <PlayerBoard
          draftedPlayerIds={
            draftedPlayerIds
          }
          isUserOnClock={isUserOnClock}
          onDraftPlayer={draftPlayer}
        />

        <div className="draft-sidebar">
          <aside
            className={`roster-health-card roster-health-${rosterHealthReport.level}`}
          >
            <div className="roster-health-heading">
              <div>
                <p className="eyebrow">
                  Adaptive roster analysis
                </p>

                <h3>Roster Health</h3>
              </div>

              <div className="roster-health-score">
                <strong>
                  {rosterHealthReport.score}
                </strong>

                <span>/100</span>
              </div>
            </div>

            <div className="roster-health-status">
              <span
                className={`roster-health-level roster-health-level-${rosterHealthReport.level}`}
              >
                {getRosterHealthLabel(
                  rosterHealthReport.level,
                )}
              </span>

              <p>
                {getRosterHealthSummary(
                  rosterHealthReport,
                )}
              </p>
            </div>

            <div className="roster-position-counts">
              {rosterPositionOrder.map(
                (position) => (
                  <div
                    className="roster-position-count"
                    key={position}
                  >
                    <span>{position}</span>

                    <strong>
                      {
                        rosterHealthReport
                          .positionCounts[
                          position
                        ]
                      }
                    </strong>
                  </div>
                ),
              )}
            </div>

            <div className="roster-health-primary-need">
              <span>
                Most urgent draft need
              </span>

              {mostUrgentRosterIssue ? (
                <>
                  <strong>
                    {
                      mostUrgentRosterIssue.title
                    }
                  </strong>

                  <p>
                    {
                      mostUrgentRosterIssue.description
                    }
                  </p>
                </>
              ) : (
                <>
                  <strong>
                    No urgent need
                  </strong>

                  <p>
                    Continue selecting the best value
                    while preserving roster balance.
                  </p>
                </>
              )}
            </div>

            {rosterHealthReport.issues.length >
              1 && (
              <div className="roster-health-issues">
                <span>
                  Other roster concerns
                </span>

                <ul>
                  {rosterHealthReport.issues
                    .slice(1, 4)
                    .map((issue) => (
                      <li
                        className={`roster-health-issue roster-health-issue-${issue.level}`}
                        key={issue.id}
                      >
                        <div>
                          <strong>
                            {issue.title}
                          </strong>

                          <span>
                            {issue.position}
                          </span>
                        </div>

                        <p>
                          {issue.description}
                        </p>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div className="roster-health-strengths">
              <span>
                Current strengths
              </span>

              {rosterHealthReport.strengths
                .length > 0 ? (
                <div>
                  {rosterHealthReport.strengths
                    .slice(0, 4)
                    .map((strength) => (
                      <span key={strength}>
                        {strength}
                      </span>
                    ))}
                </div>
              ) : (
                <p>
                  Strengths will appear as your
                  starting lineup and depth improve.
                </p>
              )}
            </div>
          </aside>

          <aside className="draft-history-card">
            <div className="draft-history-heading">
              <div>
                <p className="eyebrow">
                  Selections
                </p>

                <h3>Draft History</h3>
              </div>

              <span>
                {draftPicks.length} recorded
              </span>
            </div>

            {draftPicks.length === 0 ? (
              <div className="draft-empty-state">
                <strong>
                  No picks recorded yet
                </strong>

                <span>
                  Select a player from the
                  board to record the next
                  pick.
                </span>
              </div>
            ) : (
              <div className="draft-pick-list">
                {[...draftPicks]
                  .reverse()
                  .map((pick) => {
                    const fantasyTeam =
                      fantasyTeams.find(
                        (team) =>
                          team.id ===
                          pick.fantasyTeamId,
                      );

                    return (
                      <article
                        className={`draft-pick ${
                          fantasyTeam?.isUser
                            ? "user-draft-pick"
                            : ""
                        }`}
                        key={pick.id}
                      >
                        <span className="draft-pick-number">
                          {pick.overallPick}
                        </span>

                        <div className="draft-pick-player">
                          <strong>
                            {pick.player.name}
                          </strong>

                          <span>
                            {pick.player.position} ·{" "}
                            {pick.player.nflTeam}
                          </span>
                        </div>

                        <div className="draft-pick-manager">
                          <span>
                            {fantasyTeam?.emoji}
                          </span>

                          <strong>
                            {fantasyTeam?.name ??
                              "Unknown"}
                          </strong>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
          </aside>

          <MyRoster
            players={userDraftedPlayers}
          />
        </div>
      </div>
    </section>
  );
}

export default DraftRoom;