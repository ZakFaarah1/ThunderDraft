import { useMemo, useState } from "react";

import type {
  Player,
  Position,
} from "../types";

import DraftPlayerDetailsModal from "./DraftPlayerDetailsModal";


type PlayerFilter =
  | "ALL"
  | "ROOKIES"
  | Position;

interface PlayerBoardProps {
  players: Player[];
  draftedPlayerIds: string[];
  isRosterFull: boolean;
  isUserOnClock: boolean;
  onDraftPlayer: (player: Player) => void;
  rosterCount: number;
  rosterLimit: number;
}

const playerFilters: PlayerFilter[] = [
  "ALL",
  "ROOKIES",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];


/**
 * Displays and filters the currently available draft pool.
 */
function PlayerBoard({
  players,
  draftedPlayerIds,
  isRosterFull,
  isUserOnClock,
  onDraftPlayer,
  rosterCount,
  rosterLimit,
}: PlayerBoardProps) {
  const [searchTerm, setSearchTerm] =
    useState("");

  const [
    playerFilter,
    setPlayerFilter,
  ] = useState<PlayerFilter>("ALL");

  const [
    selectedPlayer,
    setSelectedPlayer,
  ] = useState<Player | null>(null);

  const availablePlayers = useMemo(() => {
    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    return players
      .filter(
        (player) =>
          !draftedPlayerIds.includes(
            player.id,
          ),
      )
      .filter((player) => {
        if (playerFilter === "ALL") {
          return true;
        }

        if (playerFilter === "ROOKIES") {
          return player.isRookie === true;
        }

        return player.position === playerFilter;
      })
      .filter((player) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          player.name
            .toLowerCase()
            .includes(normalizedSearch) ||
          player.nflTeam
            .toLowerCase()
            .includes(normalizedSearch) ||
          player.position
            .toLowerCase()
            .includes(normalizedSearch)
        );
      })
      .sort(
        (firstPlayer, secondPlayer) =>
          firstPlayer.overallRank -
          secondPlayer.overallRank,
      );
  }, [
    draftedPlayerIds,
    playerFilter,
    players,
    searchTerm,
  ]);

  /**
   * Opens one player's complete draft profile.
   */
  function openPlayerDetails(
    player: Player,
  ) {
    setSelectedPlayer(player);
  }


  /**
   * Closes the current player profile.
   */
  function closePlayerDetails() {
    setSelectedPlayer(null);
  }


  return (
    <>
      <section className="player-board">
      <div className="player-board-header">
        <div>
          <p className="eyebrow">
            Available player pool
          </p>

          <h3>
            {playerFilter === "ROOKIES"
              ? "2026 Rookies"
              : "Best Available"}
          </h3>
        </div>

        <span className="available-count">
          {availablePlayers.length} available
        </span>
      </div>

      <div className="player-board-controls">
        <label className="player-search">
          <span className="sr-only">
            Search players
          </span>

          <input
            onChange={(event) =>
              setSearchTerm(
                event.target.value,
              )
            }
            placeholder="Search player, team, or position..."
            type="search"
            value={searchTerm}
          />
        </label>

        <div
          aria-label="Filter available players"
          className="position-filters"
        >
          {playerFilters.map((filter) => (
            <button
              className={
                playerFilter === filter
                  ? "position-filter active-position-filter"
                  : "position-filter"
              }
              key={filter}
              onClick={() =>
                setPlayerFilter(filter)
              }
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {availablePlayers.length === 0 ? (
        <div className="draft-empty-state">
          <strong>No players found</strong>

          <span>
            Change the search or player filter.
          </span>
        </div>
      ) : (
        <div className="available-player-list">
          {availablePlayers.map((player) => (
            <article
              className="available-player-card"
              key={player.id}
            >
              <span className="available-player-rank">
                {player.overallRank}
              </span>

              <div className="player-headshot">
                {player.imageUrl ? (
                  <img
                    alt={`${player.name} headshot`}
                    loading="lazy"
                    src={player.imageUrl}
                  />
                ) : (
                  <span aria-hidden="true">
                    {player.name
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

              <div className="available-player-details">
                <div className="player-name-line">
                  <button
                    className="draft-player-name-button"
                    onClick={() =>
                      openPlayerDetails(player)
                    }
                    type="button"
                  >
                    {player.name}
                  </button>

                  {player.isRookie && (
                    <span className="rookie-badge">
                      Rookie
                    </span>
                  )}
                </div>

                <span>
                  {player.position} ·{" "}
                  {player.nflTeam} ·{" "}
                  {player.position}
                  {player.positionRank}
                </span>

                {player.isRookie &&
                  player.rookieRank !== null &&
                  player.rookieRank !==
                    undefined && (
                    <span className="rookie-rank-label">
                      Rookie rank #
                      {player.rookieRank}
                    </span>
                  )}
              </div>

              <div className="player-metrics">
                <div>
                  <span>Tier</span>
                  <strong>
                    {player.tier}
                  </strong>
                </div>

                <div>
                  <span>ADP</span>
                  <strong>
                    {player.adp?.toFixed(1) ??
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    {player.isRookie
                      ? "Est. 2026"
                      : "Proj."}
                  </span>

                  <strong>
                    {player.projectedPoints?.toFixed(
                      1,
                    ) ?? "—"}
                  </strong>
                </div>
              </div>

              <button
                className="draft-player-button"
                disabled={isRosterFull}
                onClick={() =>
                  onDraftPlayer(player)
                }
                type="button"
              >
                {isRosterFull
                  ? `Roster full · ${rosterCount}/${rosterLimit}`
                  : isUserOnClock
                    ? "Select Pick"
                    : "Drafted"}
              </button>
            </article>
          ))}
        </div>
      )}
      </section>

      {selectedPlayer && (
        <DraftPlayerDetailsModal
          isRosterFull={isRosterFull}
          isUserOnClock={isUserOnClock}
          onClose={closePlayerDetails}
          onDraftPlayer={onDraftPlayer}
          player={selectedPlayer}
          rosterCount={rosterCount}
          rosterLimit={rosterLimit}
        />
      )}
    </>
  );
}

export default PlayerBoard;
