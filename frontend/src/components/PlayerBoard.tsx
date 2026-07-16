import { useMemo, useState } from "react";
import { demoPlayers } from "../data/players";
import type { Player, Position } from "../types";

type PositionFilter = "ALL" | Position;

interface PlayerBoardProps {
  draftedPlayerIds: string[];
  isUserOnClock: boolean;
  onDraftPlayer: (player: Player) => void;
}

const positionFilters: PositionFilter[] = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

function PlayerBoard({
  draftedPlayerIds,
  isUserOnClock,
  onDraftPlayer,
}: PlayerBoardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] =
    useState<PositionFilter>("ALL");

  const availablePlayers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return demoPlayers
      .filter(
        (player) => !draftedPlayerIds.includes(player.id),
      )
      .filter((player) => {
        if (positionFilter === "ALL") {
          return true;
        }

        return player.position === positionFilter;
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
  }, [draftedPlayerIds, positionFilter, searchTerm]);

  return (
    <section className="player-board">
      <div className="player-board-header">
        <div>
          <p className="eyebrow">Available player pool</p>
          <h3>Best Available</h3>
        </div>

        <span className="available-count">
          {availablePlayers.length} available
        </span>
      </div>

      <div className="player-board-controls">
        <label className="player-search">
          <span className="sr-only">Search players</span>

          <input
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search player, team, or position..."
            type="search"
            value={searchTerm}
          />
        </label>

        <div
          aria-label="Filter players by position"
          className="position-filters"
        >
          {positionFilters.map((position) => (
            <button
              className={
                positionFilter === position
                  ? "position-filter active-position-filter"
                  : "position-filter"
              }
              key={position}
              onClick={() => setPositionFilter(position)}
              type="button"
            >
              {position}
            </button>
          ))}
        </div>
      </div>

      {availablePlayers.length === 0 ? (
        <div className="draft-empty-state">
          <strong>No players found</strong>

          <span>
            Change the search or position filter.
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
                      .map((namePart) => namePart[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                )}
              </div>

              <div className="available-player-details">
                <strong>{player.name}</strong>

                <span>
                  {player.position} · {player.nflTeam} ·{" "}
                  {player.position}
                  {player.positionRank}
                </span>
              </div>

              <div className="player-metrics">
                <div>
                  <span>Tier</span>
                  <strong>{player.tier}</strong>
                </div>

                <div>
                  <span>ADP</span>
                  <strong>
                    {player.adp?.toFixed(1) ?? "—"}
                  </strong>
                </div>

                <div>
                  <span>Proj.</span>
                  <strong>
                    {player.projectedPoints?.toFixed(1) ??
                      "—"}
                  </strong>
                </div>
              </div>

              <button
                className="draft-player-button"
                onClick={() => onDraftPlayer(player)}
                type="button"
              >
                {isUserOnClock ? "Select Pick" : "Drafted"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default PlayerBoard;