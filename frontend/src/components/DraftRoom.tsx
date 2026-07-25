import {
  FANTASY_ROSTER_LIMIT,
  getFantasyTeamRosterCount,
  isFantasyTeamRosterFull,
} from "../utils/rosterLimits";

import { useEffect, useRef, useState } from "react";

import { fantasyTeams } from "../data/league";
import { getNflTeamBrand } from "../data/nflTeams";
import {
  fetchDraftPlayers,
  fetchDraftState,
  saveDraftState,
} from "../api/client";
import { mapApiDraftPlayers } from "../api/draftPlayers";

import type {
  ApiDraftPlayerListResponse,
  ApiDraftStatePayload,
} from "../api/types";

import type {
  Player,
  Position,
} from "../types";

import {
  getFantasyTeamForPick,
  getPicksUntilNextTurn,
  getUserOverallPicks,
  isDraftComplete,
  isDraftOrderLocked,
} from "../utils/draft";

import {
  resolveInitialDraftState,
  serializeDraftState,
} from "../utils/draftPersistence";

import {
  getRosterHealthReport,
  type RosterHealthLevel,
  type RosterHealthReport,
} from "../utils/rosterHealth";

import DraftOrderSetup from "./DraftOrderSetup";
import DraftResultsModal from "./DraftResultsModal";
import MyRoster from "./MyRoster";
import PlayerBoard from "./PlayerBoard";
import RecommendationsPanel from "./RecommendationsPanel";

interface RecordedDraftPick {
  id: string;
  overallPick: number;
  fantasyTeamId: string;
  player: Player;
}


type DraftSyncStatus =
  | "loading"
  | "saving"
  | "saved"
  | "offline";

const draftOrderStorageKey =
  "thunderdraft-draft-order";

const draftPicksStorageKey =
  "thunderdraft-draft-picks-v2";

const totalDraftRounds = 15;


/**
 * Describes the current browser and SQLite save state.
 */
function getDraftSyncLabel(
  status: DraftSyncStatus,
): string {
  if (status === "loading") {
    return "Loading saved draft…";
  }

  if (status === "saving") {
    return "Saving draft…";
  }

  if (status === "offline") {
    return "Browser backup active";
  }

  return "Saved to SQLite";
}

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

interface DraftRoomProps {
  onDraftOrderEntryHandled?: () => void;
  openDraftOrderOnEntry?: boolean;
}


/**
 * Displays and controls the live fantasy draft.
 */
function DraftRoom({
  onDraftOrderEntryHandled,
  openDraftOrderOnEntry = false,
}: DraftRoomProps) {
  const [draftPicks, setDraftPicks] = useState<
    RecordedDraftPick[]
  >([]);

  const [draftOrder, setDraftOrder] =
    useState<string[]>([]);

  const [
    showDraftOrderSetup,
    setShowDraftOrderSetup,
  ] = useState(
    openDraftOrderOnEntry,
  );

  useEffect(() => {
    if (!openDraftOrderOnEntry) {
      return;
    }

    onDraftOrderEntryHandled?.();
  }, [
    onDraftOrderEntryHandled,
    openDraftOrderOnEntry,
  ]);

  const [
    showDraftResults,
    setShowDraftResults,
  ] = useState(false);

  /*
   * Null means the tracker follows the live round.
   * A number means the user is browsing that round.
   */
  const [
    viewedDraftRound,
    setViewedDraftRound,
  ] = useState<number | null>(null);

  const draftRoundRailRef =
    useRef<HTMLDivElement | null>(null);

  const [
    manualFantasyTeamId,
    setManualFantasyTeamId,
  ] = useState(fantasyTeams[0].id);

  const [
    draftPlayers,
    setDraftPlayers,
  ] = useState<Player[]>([]);

  const [
    draftPoolResponse,
    setDraftPoolResponse,
  ] =
    useState<ApiDraftPlayerListResponse | null>(
      null,
    );

  const [
    draftPoolLoading,
    setDraftPoolLoading,
  ] = useState(true);

  const [
    draftPoolError,
    setDraftPoolError,
  ] = useState<string | null>(null);

  const [
    draftStateHydrated,
    setDraftStateHydrated,
  ] = useState(false);

  const [
    draftSyncStatus,
    setDraftSyncStatus,
  ] = useState<DraftSyncStatus>(
    "loading",
  );

  const [
    draftSyncUpdatedAt,
    setDraftSyncUpdatedAt,
  ] = useState<string | null>(null);

  const [
    draftSyncError,
    setDraftSyncError,
  ] = useState<string | null>(null);

  const draftSaveQueueRef =
    useRef<Promise<void>>(
      Promise.resolve(),
    );

  const draftSaveRevisionRef =
    useRef(0);

  const lastPersistedDraftRef =
    useRef<string | null>(null);

  /**
   * Loads and maps the real 2026 player pool.
   */
  useEffect(() => {
    const controller =
      new AbortController();

    /**
     * Retrieves the current cached backend draft pool.
     */
    async function loadDraftPlayers() {
      try {
        setDraftPoolLoading(true);
        setDraftPoolError(null);

        const response =
          await fetchDraftPlayers(
            controller.signal,
          );

        if (controller.signal.aborted) {
          return;
        }

        setDraftPlayers(
          mapApiDraftPlayers(
            response.players,
          ),
        );

        setDraftPoolResponse(response);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setDraftPlayers([]);
        setDraftPoolResponse(null);

        setDraftPoolError(
          error instanceof Error
            ? error.message
            : "Unable to load the 2026 draft pool.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setDraftPoolLoading(false);
        }
      }
    }

    void loadDraftPlayers();

    return () => {
      controller.abort();
    };
  }, []);

  /*
   * Loads SQLite first and uses browser storage only as
   * a migration source or temporary offline fallback.
   */
  useEffect(() => {
    const controller =
      new AbortController();

    /**
     * Selects and loads the safest available draft snapshot.
     */
    async function hydrateDraftState() {
      const localState: ApiDraftStatePayload = {
        draftOrder:
          loadSavedDraftOrder(),
        picks:
          loadSavedDraftPicks(),
      };

      try {
        const serverState =
          await fetchDraftState(
            controller.signal,
          );

        if (controller.signal.aborted) {
          return;
        }

        const resolution =
          resolveInitialDraftState(
            serverState,
            localState,
          );

        let updatedAt =
          serverState.updatedAt;

        if (
          resolution.shouldMigrateLocal
        ) {
          setDraftSyncStatus(
            "saving",
          );

          const savedState =
            await saveDraftState(
              resolution.state,
              controller.signal,
            );

          if (
            controller.signal.aborted
          ) {
            return;
          }

          updatedAt =
            savedState.updatedAt;
        }

        setDraftOrder(
          resolution.state.draftOrder,
        );

        setDraftPicks(
          resolution.state.picks,
        );

        localStorage.setItem(
          draftOrderStorageKey,
          JSON.stringify(
            resolution.state.draftOrder,
          ),
        );

        localStorage.setItem(
          draftPicksStorageKey,
          JSON.stringify(
            resolution.state.picks,
          ),
        );

        lastPersistedDraftRef.current =
          serializeDraftState(
            resolution.state,
          );

        setDraftSyncUpdatedAt(
          updatedAt,
        );

        setDraftSyncError(null);
        setDraftSyncStatus("saved");
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setDraftOrder(
          localState.draftOrder,
        );

        setDraftPicks(
          localState.picks,
        );

        lastPersistedDraftRef.current =
          null;

        setDraftSyncError(
          error instanceof Error
            ? error.message
            : "SQLite draft storage is unavailable.",
        );

        setDraftSyncStatus(
          "offline",
        );
      } finally {
        if (!controller.signal.aborted) {
          setDraftStateHydrated(true);
        }
      }
    }

    void hydrateDraftState();

    return () => {
      controller.abort();
    };
  }, []);

  /*
   * Writes every state change to localStorage immediately,
   * then sends complete snapshots to SQLite in order.
   */
  useEffect(() => {
    if (!draftStateHydrated) {
      return;
    }

    const snapshot: ApiDraftStatePayload = {
      draftOrder,
      picks: draftPicks,
    };

    localStorage.setItem(
      draftOrderStorageKey,
      JSON.stringify(draftOrder),
    );

    localStorage.setItem(
      draftPicksStorageKey,
      JSON.stringify(draftPicks),
    );

    const serializedSnapshot =
      serializeDraftState(snapshot);

    if (
      serializedSnapshot ===
      lastPersistedDraftRef.current
    ) {
      return;
    }

    const saveRevision =
      draftSaveRevisionRef.current + 1;

    draftSaveRevisionRef.current =
      saveRevision;

    setDraftSyncStatus("saving");
    setDraftSyncError(null);

    const pendingSave =
      draftSaveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const savedState =
              await saveDraftState(
                snapshot,
              );

            lastPersistedDraftRef.current =
              serializedSnapshot;

            if (
              saveRevision ===
              draftSaveRevisionRef.current
            ) {
              setDraftSyncUpdatedAt(
                savedState.updatedAt,
              );

              setDraftSyncStatus(
                "saved",
              );
            }
          } catch (error) {
            if (
              saveRevision ===
              draftSaveRevisionRef.current
            ) {
              setDraftSyncError(
                error instanceof Error
                  ? error.message
                  : "Draft could not be saved to SQLite.",
              );

              setDraftSyncStatus(
                "offline",
              );
            }
          }
        });

    draftSaveQueueRef.current =
      pendingSave;
  }, [
    draftOrder,
    draftPicks,
    draftStateHydrated,
  ]);

  if (!draftStateHydrated) {
    return (
      <section className="draft-room">
        <div className="draft-pool-status">
          <strong>
            Loading saved draft…
          </strong>

          <span>
            Checking SQLite and your browser backup.
          </span>
        </div>
      </section>
    );
  }

  const nextOverallPick =
    draftPicks.length + 1;

  const draftIsComplete =
    isDraftComplete(
      draftPicks.length,
      fantasyTeams.length,
      totalDraftRounds,
    );

  const liveDraftRound =
    draftIsComplete
      ? totalDraftRounds
      : Math.min(
          totalDraftRounds,
          Math.floor(
            (nextOverallPick - 1) /
              fantasyTeams.length,
          ) + 1,
        );

  const displayedDraftRound =
    viewedDraftRound ?? liveDraftRound;

  const draftOrderIsLocked =
    isDraftOrderLocked(
      draftPicks.length,
    );

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

  const activeTeamRosterCount =
    getFantasyTeamRosterCount(
      draftPicks,
      activeFantasyTeamId,
    );

  const isActiveTeamRosterFull =
    activeTeamRosterCount >=
    FANTASY_ROSTER_LIMIT;

  const isUserOnClock =
    activeFantasyTeam?.isUser === true;

  const draftedPlayerIds = draftPicks.map(
    (pick) => pick.player.id,
  );

  const lastRecordedPick =
    draftPicks[draftPicks.length - 1] ??
    null;

  const lastPickFantasyTeam =
    lastRecordedPick
      ? fantasyTeams.find(
          (team) =>
            team.id ===
            lastRecordedPick.fantasyTeamId,
        ) ?? null
      : null;

  const lastPickNflTeamBrand =
    lastRecordedPick
      ? getNflTeamBrand(
          lastRecordedPick.player.nflTeam,
        )
      : null;

  const availablePlayers = draftPlayers.filter(
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
    if (draftOrderIsLocked) {
      return;
    }

    setDraftOrder(teamIds);

    setShowDraftOrderSetup(false);
  }

  /**
   * Clears the saved draft order before the draft begins.
   */
  function clearDraftOrder() {
    if (draftOrderIsLocked) {
      return;
    }

    setDraftOrder([]);
  }

  /**
   * Records a player for the team currently on the clock.
   */
  function draftPlayer(player: Player) {
    if (draftIsComplete) {
      return;
    }

    if (!activeFantasyTeamId) {
      window.alert(
        "Select a fantasy team before drafting a player.",
      );

      return;
    }

    if (
      isFantasyTeamRosterFull(
        draftPicks,
        activeFantasyTeamId,
      )
    ) {
      window.alert(
        `Roster full: each team is limited to ${FANTASY_ROSTER_LIMIT} players.`,
      );

      return;
    }

    if (draftedPlayerIds.includes(player.id)) {
      return;
    }

    setShowDraftOrderSetup(false);

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
    setShowDraftResults(false);

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

    setShowDraftResults(false);
    setDraftPicks([]);

  }

  return (
    <section
      className={`draft-room ${
        isUserOnClock
          ? "user-on-clock"
          : ""
      }`}
    >
      {lastRecordedPick && (
        <aside
          className="floating-last-pick-card"
          style={{
            borderColor: `${
              lastPickNflTeamBrand?.secondaryColor ??
              "#4ade80"
            }88`,
            background: `linear-gradient(
              145deg,
              ${
                lastPickNflTeamBrand?.primaryColor ??
                "#0f2a1a"
              }E6,
              rgba(7, 7, 7, 0.98)
            )`,
            boxShadow: `0 20px 45px rgba(0, 0, 0, 0.34),
              0 0 28px ${
                lastPickNflTeamBrand?.secondaryColor ??
                "#22c55e"
              }22`,
          }}
        >
          <p className="eyebrow">
            Last Pick
          </p>

          <div className="floating-last-pick-player">
            <div className="floating-last-pick-headshot">
              {lastRecordedPick.player.imageUrl ? (
                <img
                  alt={`${lastRecordedPick.player.name} headshot`}
                  src={
                    lastRecordedPick.player.imageUrl
                  }
                />
              ) : (
                <span aria-hidden="true">
                  {lastRecordedPick.player.name
                    .split(" ")
                    .map(
                      (namePart) =>
                        namePart[0],
                    )
                    .join("")
                    .slice(0, 2)}
                </span>
              )}
            </div>

            <div className="floating-last-pick-details">
              <strong>
                {lastRecordedPick.player.name}
              </strong>

              <span>
                {lastRecordedPick.player.position} ·{" "}
                {lastRecordedPick.player.nflTeam}
              </span>
            </div>
          </div>

          <div className="floating-last-pick-footer">
            <span>
              {lastPickFantasyTeam?.emoji ??
                "🏈"}{" "}
              {lastPickFantasyTeam?.name ??
                "Unknown"}
            </span>

            <strong>
              Pick #{lastRecordedPick.overallPick}
            </strong>
          </div>
        </aside>
      )}

      <div className="section-heading">
        <div>
          <p className="eyebrow">
            Live draft control
          </p>

          <h2>Draft Room</h2>
        </div>

        <div className="draft-room-actions">
          <span
            className={`draft-sync-badge draft-sync-${draftSyncStatus}`}
            title={
              draftSyncError ??
              (draftSyncUpdatedAt
                ? `Last server save: ${new Date(
                    draftSyncUpdatedAt,
                  ).toLocaleString()}`
                : "SQLite draft storage is ready.")
            }
          >
            {getDraftSyncLabel(
              draftSyncStatus,
            )}
          </span>
          <button
            className="secondary-button compact-button"
            disabled={draftOrderIsLocked}
            onClick={() =>
              setShowDraftOrderSetup(
                (currentValue) =>
                  !currentValue,
              )
            }
            type="button"
          >
            {draftOrderIsLocked
              ? "Draft Order Locked"
              : showDraftOrderSetup
                ? "Close Order Setup"
                : hasDraftOrder
                  ? "Edit Draft Order"
                  : "Set Draft Order"}
          </button>

          {draftIsComplete && (
            <button
              className="secondary-button compact-button"
              onClick={() =>
                setShowDraftResults(true)
              }
              type="button"
            >
              View Draft Results
            </button>
          )}

          <span className="current-pick-badge">
            {draftIsComplete
              ? "Draft complete"
              : `Pick ${nextOverallPick}`}
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

      {showDraftOrderSetup &&
        !draftOrderIsLocked && (
        <DraftOrderSetup
          initialOrder={draftOrder}
          onClear={clearDraftOrder}
          onSave={saveDraftOrder}
        />
      )}



      {!draftIsComplete &&
        isUserOnClock && (
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

      {!draftIsComplete &&
        isUserOnClock && (
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
          isRosterFull={
            isActiveTeamRosterFull
          }
          isUserOnClock={
            isUserOnClock
          }
          rosterCount={
            activeTeamRosterCount
          }
          rosterLimit={
            FANTASY_ROSTER_LIMIT
          }
          onDraftPlayer={draftPlayer}
        />
      )}

      {draftPoolLoading && (
        <div className="draft-pool-status">
          <strong>
            Loading 2026 draft pool…
          </strong>

          <span>
            Retrieving players, rookies, and ADP.
          </span>
        </div>
      )}

      {draftPoolError && (
        <div className="draft-pool-status draft-pool-error">
          <strong>
            Draft pool unavailable
          </strong>

          <span>{draftPoolError}</span>
        </div>
      )}

      {!draftPoolLoading &&
        !draftPoolError &&
        draftPoolResponse && (
          <div className="draft-pool-status">
            <strong>
              {draftPoolResponse.draftSeason} half-PPR pool
            </strong>

            <span>
              {draftPoolResponse.playerCount} players ·{" "}
              {draftPoolResponse.rookieCount} rookies ·{" "}
              {draftPoolResponse.matchedAdpPlayerCount} ADP matches
              {draftPoolResponse.stale
                ? " · cached fallback"
                : ""}
            </span>
            <span className="draft-data-updated">
              Player data updated:{" "}
              {new Intl.DateTimeFormat(
                "en-US",
                {
                  dateStyle: "long",
                  timeStyle: "short",
                },
              ).format(
                new Date(
                  draftPoolResponse.cachedAt,
                ),
              )}
              {draftPoolResponse.stale
                ? " · Cached fallback"
                : ""}
            </span>
          </div>
        )}

      {!draftIsComplete ? (
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
      ) : (
        <div className="draft-complete-card">
          <div className="draft-complete-icon">
            🏆
          </div>

          <div>
            <p className="eyebrow">
              All selections recorded
            </p>

            <h3>Draft Complete</h3>

            <span>
              All {draftPicks.length} picks across{" "}
              {totalDraftRounds} rounds are complete.
              Open Draft Results to review every roster.
            </span>
          </div>

          <button
            className="draft-player-button"
            onClick={() =>
              setShowDraftResults(true)
            }
            type="button"
          >
            View Draft Results
          </button>
        </div>
      )}

      {fantasyTeams.length > 0 && (() => {
        const teamCount =
          fantasyTeams.length;

        const roundStartPick =
          (displayedDraftRound - 1) *
            teamCount +
          1;

        const isViewingLiveRound =
          viewedDraftRound === null ||
          displayedDraftRound ===
            liveDraftRound;

        return (
          <section className="draft-round-rail-card">
            <div className="draft-round-rail-heading">
              <div>
                <p className="eyebrow">
                  {isViewingLiveRound
                    ? "Live draft tracker"
                    : "Draft history"}
                </p>

                <h3>
                  Round {displayedDraftRound}
                </h3>
              </div>

              <div className="draft-round-navigation">
                <button
                  className="draft-round-nav-button"
                  disabled={
                    displayedDraftRound <= 1
                  }
                  onClick={() =>
                    setViewedDraftRound(
                      Math.max(
                        1,
                        displayedDraftRound - 1,
                      ),
                    )
                  }
                  type="button"
                >
                  ← Previous
                </button>

                <button
                  className={`draft-round-nav-button ${
                    isViewingLiveRound
                      ? "active-draft-round-nav"
                      : ""
                  }`}
                  onClick={() =>
                    setViewedDraftRound(null)
                  }
                  type="button"
                >
                  Live Round {liveDraftRound}
                </button>

                <button
                  className="draft-round-nav-button"
                  disabled={
                    displayedDraftRound >=
                    totalDraftRounds
                  }
                  onClick={() =>
                    setViewedDraftRound(
                      Math.min(
                        totalDraftRounds,
                        displayedDraftRound + 1,
                      ),
                    )
                  }
                  type="button"
                >
                  Next →
                </button>

                <span className="draft-round-recorded-count">
                  {draftPicks.length} recorded
                </span>
              </div>
            </div>

            <div className="draft-round-rail-shell">
              <button
                aria-label="Scroll draft ticker left"
                className="draft-round-scroll-button draft-round-scroll-left"
                onClick={() =>
                  draftRoundRailRef.current?.scrollBy({
                    behavior: "smooth",
                    left: -520,
                  })
                }
                type="button"
              >
                ‹
              </button>

              <div
                className="draft-round-rail"
                ref={draftRoundRailRef}
              >
              {Array.from(
                { length: teamCount },
                (_, roundIndex) => {
                  const overallPick =
                    roundStartPick +
                    roundIndex;

                  const recordedPick =
                    draftPicks.find(
                      (pick) =>
                        pick.overallPick ===
                        overallPick,
                    );

                  const isCurrentPick =
                    !draftIsComplete &&
                    overallPick ===
                      nextOverallPick;

                  const draftOrderIndex =
                    displayedDraftRound % 2 === 1
                      ? roundIndex
                      : teamCount -
                        roundIndex -
                        1;

                  const fantasyTeamId =
                    draftOrder[
                      draftOrderIndex
                    ];

                  const fantasyTeam =
                    fantasyTeams.find(
                      (team) =>
                        team.id ===
                        fantasyTeamId,
                    );

                  const nflTeamBrand =
                    recordedPick
                      ? getNflTeamBrand(
                          recordedPick
                            .player.nflTeam,
                        )
                      : null;

                  const primaryColor =
                    nflTeamBrand
                      ?.primaryColor ??
                    (isCurrentPick
                      ? "#14532D"
                      : "#111827");

                  const secondaryColor =
                    nflTeamBrand
                      ?.secondaryColor ??
                    (isCurrentPick
                      ? "#4ADE80"
                      : "#6B7280");

                  const roundPickLabel =
                    `${displayedDraftRound}.` +
                    String(
                      roundIndex + 1,
                    ).padStart(2, "0");

                  return (
                    <article
                      className={[
                        "draft-round-pick",
                        recordedPick
                          ? "completed-round-pick"
                          : "",
                        isCurrentPick
                          ? "current-round-pick"
                          : "",
                        fantasyTeam?.isUser
                          ? "user-round-pick"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={overallPick}
                      style={{
                        borderColor:
                          `${secondaryColor}99`,
                        background:
                          `linear-gradient(145deg, ${primaryColor}CC, rgba(7, 10, 14, 0.98))`,
                      }}
                    >
                      <div className="draft-round-pick-topline">
                        <span>
                          {roundPickLabel}
                        </span>

                        <strong>
                          #{overallPick}
                        </strong>
                      </div>

                      {recordedPick ? (
                        <>
                          <div className="draft-round-player-summary">
                            {nflTeamBrand ? (
                              <img
                                alt=""
                                aria-hidden="true"
                                className="draft-round-nfl-logo"
                                src={
                                  nflTeamBrand.logoUrl
                                }
                              />
                            ) : (
                              <span className="draft-round-nfl-logo-fallback">
                                🏈
                              </span>
                            )}

                            <div className="draft-round-player-copy">
                              <strong className="draft-round-player-name">
                                {
                                  recordedPick
                                    .player.name
                                }
                              </strong>

                              <span className="draft-round-player-meta">
                                {
                                  recordedPick
                                    .player
                                    .position
                                }{" "}
                                ·{" "}
                                {
                                  recordedPick
                                    .player
                                    .nflTeam
                                }
                              </span>
                            </div>
                          </div>

                          <div className="draft-round-manager-brand">
                            <span>
                              {fantasyTeam?.emoji ??
                                "🏈"}
                            </span>

                            <small>
                              {fantasyTeam?.name ??
                                "Unknown"}
                            </small>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="draft-round-manager-brand pending-manager-brand">
                            <span>
                              {fantasyTeam?.emoji ??
                                "🏈"}
                            </span>

                            <strong>
                              {fantasyTeam?.name ??
                                "Unknown team"}
                            </strong>
                          </div>

                          {isCurrentPick ? (
                            <>
                              <strong className="draft-round-current-label">
                                On the Clock
                              </strong>

                            </>
                          ) : (
                            <>
                              <strong className="draft-round-pending-label">
                                Pending
                              </strong>

                            </>
                          )}
                        </>
                      )}
                    </article>
                  );
                },
              )}
              </div>

              <button
                aria-label="Scroll draft ticker right"
                className="draft-round-scroll-button draft-round-scroll-right"
                onClick={() =>
                  draftRoundRailRef.current?.scrollBy({
                    behavior: "smooth",
                    left: 520,
                  })
                }
                type="button"
              >
                ›
              </button>
            </div>
          </section>
        );
      })()}

      <div className="draft-room-layout">
        <div className="draft-main-column">
          <PlayerBoard
          players={draftPlayers}
            draftedPlayerIds={
              draftedPlayerIds
            }
            isRosterFull={
              isActiveTeamRosterFull
            }
            isUserOnClock={isUserOnClock}
            onDraftPlayer={draftPlayer}
            rosterCount={
              activeTeamRosterCount
            }
            rosterLimit={
              FANTASY_ROSTER_LIMIT
            }
          />

        </div>

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

          <MyRoster
            players={userDraftedPlayers}
          />

        </div>
      </div>
      {showDraftResults &&
        draftIsComplete && (
          <DraftResultsModal
            draftOrder={draftOrder}
            onClose={() =>
              setShowDraftResults(false)
            }
            picks={draftPicks}
            teams={fantasyTeams}
            totalRounds={totalDraftRounds}
          />
        )}

    </section>
  );
}

export default DraftRoom;