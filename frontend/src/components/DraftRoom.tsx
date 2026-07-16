import { useState } from "react";
import { fantasyTeams } from "../data/league";
import type { Player } from "../types";
import { getFantasyTeamForPick } from "../utils/draft";
import DraftOrderSetup from "./DraftOrderSetup";
import MyRoster from "./MyRoster";
import PlayerBoard from "./PlayerBoard";

interface RecordedDraftPick {
  id: string;
  overallPick: number;
  fantasyTeamId: string;
  player: Player;
}

const draftOrderStorageKey = "thunderdraft-draft-order";

function loadSavedDraftOrder(): string[] {
  try {
    const savedOrder = localStorage.getItem(
      draftOrderStorageKey,
    );

    if (!savedOrder) {
      return [];
    }

    const parsedOrder: unknown = JSON.parse(savedOrder);

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
      new Set(parsedOrder).size === fantasyTeams.length;

    if (!allTeamsAreValid || !containsEveryTeam) {
      return [];
    }

    return parsedOrder;
  } catch {
    return [];
  }
}

function DraftRoom() {
  const [draftPicks, setDraftPicks] = useState<
    RecordedDraftPick[]
  >([]);

  const [draftOrder, setDraftOrder] = useState<string[]>(
    loadSavedDraftOrder,
  );

  const [
    showDraftOrderSetup,
    setShowDraftOrderSetup,
  ] = useState(false);

  const [
    manualFantasyTeamId,
    setManualFantasyTeamId,
  ] = useState(fantasyTeams[0].id);

  const nextOverallPick = draftPicks.length + 1;

  const hasDraftOrder =
    draftOrder.length === fantasyTeams.length &&
    new Set(draftOrder).size === fantasyTeams.length;

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
    (team) => team.id === activeFantasyTeamId,
  );

  const isUserOnClock =
    activeFantasyTeam?.isUser === true;

  const draftedPlayerIds = draftPicks.map(
    (pick) => pick.player.id,
  );

  const userFantasyTeamId = fantasyTeams.find(
    (team) => team.isUser,
  )?.id;

  const userDraftedPlayers = draftPicks
    .filter(
      (pick) =>
        pick.fantasyTeamId === userFantasyTeamId,
    )
    .map((pick) => pick.player);

  function saveDraftOrder(teamIds: string[]) {
    setDraftOrder(teamIds);

    localStorage.setItem(
      draftOrderStorageKey,
      JSON.stringify(teamIds),
    );

    setShowDraftOrderSetup(false);
  }

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

  function undoLastPick() {
    setDraftPicks((currentPicks) =>
      currentPicks.slice(0, -1),
    );
  }

  return (
    <section
      className={`draft-room ${
        isUserOnClock ? "user-on-clock" : ""
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
                (currentValue) => !currentValue,
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
            className="secondary-button compact-button"
            disabled={draftPicks.length === 0}
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
            {activeFantasyTeam?.emoji ?? "🏈"}
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
            <span>Automatic snake order</span>

            <strong>
              Draft slot {currentDraftSlot} · Pick{" "}
              {nextOverallPick}
            </strong>
          </div>
        ) : (
          <label className="field-group manager-picker">
            <span>Select league member</span>

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
                  {team.isUser ? " — You" : ""}
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
            Recommendations are ready
          </span>
        </div>
      )}

      <div className="draft-room-layout">
        <PlayerBoard
          draftedPlayerIds={draftedPlayerIds}
          isUserOnClock={isUserOnClock}
          onDraftPlayer={draftPlayer}
        />

        <div className="draft-sidebar">
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
                  Select a player from the board to
                  record the next pick.
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

          <MyRoster players={userDraftedPlayers} />
        </div>
      </div>
    </section>
  );
}

export default DraftRoom;