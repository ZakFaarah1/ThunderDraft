import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  fetchPlayerHistory,
  fetchPlayerStats,
} from "../api/client";
import type {
  ApiPlayerHistoryResponse,
  ApiPlayerSeasonStats,
  OffensivePosition,
} from "../api/types";

type PositionFilter =
  | "ALL"
  | OffensivePosition;

type SortField =
  | "rank"
  | "halfPprPoints"
  | "pointsPerGame"
  | "totalYards"
  | "totalTouchdowns";

type SortDirection =
  | "ascending"
  | "descending";

const positionFilters: PositionFilter[] = [
  "ALL",
  "QB",
  "RB",
  "WR",
  "TE",
];

const availableSeasons = [
  2025,
  2024,
  2023,
  2022,
];


/**
 * Creates short initials for a missing player headshot.
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
 * Formats a number with commas for easier reading.
 */
function formatNumber(
  value: number,
): string {
  return value.toLocaleString();
}


/**
 * Displays a headshot or initials when no usable image exists.
 */
function PlayerHeadshot({
  player,
  isLarge = false,
}: {
  player: ApiPlayerSeasonStats;
  isLarge?: boolean;
}) {
  const imageUrl =
    player.imageUrl
    ?? player.fallbackImageUrl;

  const [imageFailed, setImageFailed] =
    useState(false);

  /*
   * Allows a newly selected player image to load normally.
   */
  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const shouldShowImage =
    Boolean(imageUrl)
    && !imageFailed;

  return (
    <div
      className={
        isLarge
          ? "stats-player-headshot stats-modal-headshot"
          : "stats-player-headshot"
      }
    >
      {shouldShowImage && imageUrl ? (
        <img
          alt={`${player.name} headshot`}
          loading="lazy"
          onError={() => {
            setImageFailed(true);
          }}
          src={imageUrl}
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
 * Displays a labeled statistic inside the player popup.
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
 * Displays searchable and sortable NFL season statistics.
 */
function StatsPage() {
  const [selectedSeason, setSelectedSeason] =
    useState(2025);

  const [players, setPlayers] = useState<
    ApiPlayerSeasonStats[]
  >([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [
    positionFilter,
    setPositionFilter,
  ] = useState<PositionFilter>("ALL");

  const [sortField, setSortField] =
    useState<SortField>("halfPprPoints");

  const [sortDirection, setSortDirection] =
    useState<SortDirection>("descending");

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [
    selectedPlayer,
    setSelectedPlayer,
  ] = useState<ApiPlayerSeasonStats | null>(
    null,
  );

  const [
    selectedHistory,
    setSelectedHistory,
  ] = useState<ApiPlayerHistoryResponse | null>(
    null,
  );

  const [
    isHistoryLoading,
    setIsHistoryLoading,
  ] = useState(false);

  const [
    historyErrorMessage,
    setHistoryErrorMessage,
  ] = useState<string | null>(null);

  const historyRequestNumber = useRef(0);

  /*
   * Loads the selected season whenever the season changes.
   */
  useEffect(() => {
    const controller = new AbortController();

    setIsLoading(true);
    setErrorMessage(null);
    setPlayers([]);
    setSelectedPlayer(null);
    setSelectedHistory(null);

    fetchPlayerStats(
      selectedSeason,
      controller.signal,
    )
      .then((response) => {
        setPlayers(response.players);
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException
          && error.name === "AbortError"
        ) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Player statistics could not be loaded.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedSeason]);

  /*
   * Closes the popup with Escape and prevents background scrolling.
   */
  useEffect(() => {
    if (!selectedPlayer) {
      return;
    }

    const originalOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";


    /**
     * Closes the player popup when Escape is pressed.
     */
    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        closePlayerModal();
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
  }, [selectedPlayer]);

  const visiblePlayers = useMemo(() => {
    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    return players
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
            .includes(normalizedSearch)
          || player.nflTeam
            .toLowerCase()
            .includes(normalizedSearch)
          || player.position
            .toLowerCase()
            .includes(normalizedSearch)
        );
      })
      .sort((firstPlayer, secondPlayer) => {
        const firstValue =
          firstPlayer[sortField];

        const secondValue =
          secondPlayer[sortField];

        const difference =
          firstValue - secondValue;

        return sortDirection === "ascending"
          ? difference
          : -difference;
      });
  }, [
    players,
    positionFilter,
    searchTerm,
    sortDirection,
    sortField,
  ]);

  const modalSeasonStats = selectedPlayer
    ? (
        selectedHistory?.seasons.find(
          (season) =>
            season.season === selectedSeason,
        )
        ?? selectedPlayer
      )
    : null;


  /**
   * Changes the active sorting field or reverses its direction.
   */
  function handleSort(
    nextSortField: SortField,
  ) {
    if (sortField === nextSortField) {
      setSortDirection(
        sortDirection === "ascending"
          ? "descending"
          : "ascending",
      );

      return;
    }

    setSortField(nextSortField);

    setSortDirection(
      nextSortField === "rank"
        ? "ascending"
        : "descending",
    );
  }


  /**
   * Opens the popup and loads the player's complete history.
   */
  async function handleSelectPlayer(
    player: ApiPlayerSeasonStats,
  ) {
    const requestNumber =
      historyRequestNumber.current + 1;

    historyRequestNumber.current =
      requestNumber;

    setSelectedPlayer(player);
    setSelectedHistory(null);
    setHistoryErrorMessage(null);
    setIsHistoryLoading(true);

    try {
      const history = await fetchPlayerHistory(
        player.gsisId,
      );

      if (
        historyRequestNumber.current
        !== requestNumber
      ) {
        return;
      }

      setSelectedHistory(history);
    } catch (error: unknown) {
      if (
        historyRequestNumber.current
        !== requestNumber
      ) {
        return;
      }

      setHistoryErrorMessage(
        error instanceof Error
          ? error.message
          : "Player history could not be loaded.",
      );
    } finally {
      if (
        historyRequestNumber.current
        === requestNumber
      ) {
        setIsHistoryLoading(false);
      }
    }
  }


  /**
   * Closes the player popup and ignores unfinished requests.
   */
  function closePlayerModal() {
    historyRequestNumber.current += 1;

    setSelectedPlayer(null);
    setSelectedHistory(null);
    setHistoryErrorMessage(null);
    setIsHistoryLoading(false);
  }


  /**
   * Closes the popup when its dark background is clicked.
   */
  function handleModalBackdropClick(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if (
      event.target === event.currentTarget
    ) {
      closePlayerModal();
    }
  }


  /**
   * Returns the arrow shown beside the active table sort.
   */
  function getSortIndicator(
    field: SortField,
  ): string {
    if (sortField !== field) {
      return "";
    }

    return sortDirection === "ascending"
      ? " ↑"
      : " ↓";
  }

  return (
    <section className="stats-page">
      <div className="stats-page-heading">
        <div>
          <p className="eyebrow">
            Historical player performance
          </p>

          <h2>NFL Player Stats</h2>

          <p>
            Regular-season half-PPR statistics from
            2022 through 2025.
          </p>
        </div>

        <div className="stats-season-control">
          <label htmlFor="stats-season">
            Season
          </label>

          <select
            id="stats-season"
            onChange={(event) =>
              setSelectedSeason(
                Number(event.target.value),
              )
            }
            value={selectedSeason}
          >
            {availableSeasons.map((season) => (
              <option
                key={season}
                value={season}
              >
                {season}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stats-summary-row">
        <div className="stats-summary-card">
          <span>Season</span>
          <strong>{selectedSeason}</strong>
        </div>

        <div className="stats-summary-card">
          <span>Loaded players</span>
          <strong>{players.length}</strong>
        </div>

        <div className="stats-summary-card">
          <span>Visible players</span>
          <strong>{visiblePlayers.length}</strong>
        </div>

        <div className="stats-summary-card">
          <span>Scoring</span>
          <strong>Half-PPR</strong>
        </div>
      </div>

      <div className="stats-controls">
        <label className="stats-search">
          <span>Search players</span>

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
          aria-label="Filter statistics by position"
          className="stats-position-filters"
        >
          {positionFilters.map((position) => (
            <button
              className={
                positionFilter === position
                  ? "stats-position-filter active-stats-filter"
                  : "stats-position-filter"
              }
              key={position}
              onClick={() =>
                setPositionFilter(position)
              }
              type="button"
            >
              {position}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="stats-message">
          Loading {selectedSeason} statistics...
        </div>
      )}

      {errorMessage && (
        <div className="stats-message stats-error">
          {errorMessage}
        </div>
      )}

      {!isLoading && !errorMessage && (
        <div className="stats-table-wrapper">
          <table className="stats-table">
            <thead>
              <tr>
                <th>
                  <button
                    onClick={() =>
                      handleSort("rank")
                    }
                    type="button"
                  >
                    {selectedSeason} Finish
                    {getSortIndicator("rank")}
                  </button>
                </th>

                <th>Player</th>
                <th>G</th>

                <th>
                  <button
                    onClick={() =>
                      handleSort("halfPprPoints")
                    }
                    type="button"
                  >
                    Half-PPR
                    {getSortIndicator(
                      "halfPprPoints",
                    )}
                  </button>
                </th>

                <th>
                  <button
                    onClick={() =>
                      handleSort("pointsPerGame")
                    }
                    type="button"
                  >
                    PPG
                    {getSortIndicator(
                      "pointsPerGame",
                    )}
                  </button>
                </th>

                <th>Pass Yds</th>
                <th>Rush Yds</th>
                <th>Rec Yds</th>

                <th>
                  <button
                    onClick={() =>
                      handleSort("totalYards")
                    }
                    type="button"
                  >
                    Total Yds
                    {getSortIndicator(
                      "totalYards",
                    )}
                  </button>
                </th>

                <th>
                  <button
                    onClick={() =>
                      handleSort("totalTouchdowns")
                    }
                    type="button"
                  >
                    TD
                    {getSortIndicator(
                      "totalTouchdowns",
                    )}
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {visiblePlayers.map((player) => (
                <tr
                  className={
                    selectedPlayer?.gsisId
                    === player.gsisId
                      ? "selected-stats-row"
                      : ""
                  }
                  key={`${player.season}-${player.gsisId}`}
                >
                  <td>
                    <strong>#{player.rank}</strong>

                    <span className="stats-position-rank">
                      {player.position}
                      {player.positionRank}
                    </span>
                  </td>

                  <td>
                    <button
                      className="stats-player-button"
                      onClick={() =>
                        handleSelectPlayer(player)
                      }
                      type="button"
                    >
                      <PlayerHeadshot
                        player={player}
                      />

                      <span>
                        <strong>{player.name}</strong>

                        <small>
                          {player.position} ·{" "}
                          {player.nflTeam || "FA"}
                        </small>
                      </span>
                    </button>
                  </td>

                  <td>{player.games}</td>

                  <td>
                    {player.halfPprPoints.toFixed(1)}
                  </td>

                  <td>
                    {player.pointsPerGame.toFixed(1)}
                  </td>

                  <td>
                    {formatNumber(
                      player.passingYards,
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      player.rushingYards,
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      player.receivingYards,
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      player.totalYards,
                    )}
                  </td>

                  <td>{player.totalTouchdowns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPlayer && modalSeasonStats && (
        <div
          className="stats-modal-backdrop"
          onMouseDown={
            handleModalBackdropClick
          }
        >
          <section
            aria-labelledby="player-stats-modal-title"
            aria-modal="true"
            className="stats-player-modal"
            role="dialog"
          >
            <header className="stats-modal-header">
              <div className="stats-modal-player">
                <PlayerHeadshot
                  isLarge
                  player={selectedPlayer}
                />

                <div>
                  <p className="eyebrow">
                    {selectedSeason} player profile
                  </p>

                  <h3 id="player-stats-modal-title">
                    {modalSeasonStats.name}
                  </h3>

                  <p>
                    {modalSeasonStats.position} ·{" "}
                    {modalSeasonStats.nflTeam || "FA"} ·{" "}
                    {modalSeasonStats.position}
                    {modalSeasonStats.positionRank}
                  </p>
                </div>
              </div>

              <button
                aria-label="Close player statistics"
                className="stats-modal-close"
                onClick={closePlayerModal}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="stats-modal-summary">
              <ModalStatistic
                label={`${selectedSeason} finish`}
                value={`#${modalSeasonStats.rank}`}
              />

              <ModalStatistic
                label="Half-PPR points"
                value={
                  modalSeasonStats
                    .halfPprPoints
                    .toFixed(1)
                }
              />

              <ModalStatistic
                label="Points per game"
                value={
                  modalSeasonStats
                    .pointsPerGame
                    .toFixed(1)
                }
              />

              <ModalStatistic
                label="Games"
                value={modalSeasonStats.games}
              />
            </div>

            <div className="stats-modal-category-grid">
              <section className="stats-modal-category">
                <h4>Passing</h4>

                <div className="stats-modal-stat-grid">
                  <ModalStatistic
                    label="Completions"
                    value={
                      modalSeasonStats
                        .passingCompletions
                    }
                  />

                  <ModalStatistic
                    label="Attempts"
                    value={
                      modalSeasonStats
                        .passingAttempts
                    }
                  />

                  <ModalStatistic
                    label="Yards"
                    value={formatNumber(
                      modalSeasonStats
                        .passingYards,
                    )}
                  />

                  <ModalStatistic
                    label="Touchdowns"
                    value={
                      modalSeasonStats
                        .passingTouchdowns
                    }
                  />

                  <ModalStatistic
                    label="Interceptions"
                    value={
                      modalSeasonStats
                        .passingInterceptions
                    }
                  />
                </div>
              </section>

              <section className="stats-modal-category">
                <h4>Rushing</h4>

                <div className="stats-modal-stat-grid">
                  <ModalStatistic
                    label="Carries"
                    value={
                      modalSeasonStats.carries
                    }
                  />

                  <ModalStatistic
                    label="Yards"
                    value={formatNumber(
                      modalSeasonStats
                        .rushingYards,
                    )}
                  />

                  <ModalStatistic
                    label="Touchdowns"
                    value={
                      modalSeasonStats
                        .rushingTouchdowns
                    }
                  />
                </div>
              </section>

              <section className="stats-modal-category">
                <h4>Receiving</h4>

                <div className="stats-modal-stat-grid">
                  <ModalStatistic
                    label="Targets"
                    value={
                      modalSeasonStats.targets
                    }
                  />

                  <ModalStatistic
                    label="Receptions"
                    value={
                      modalSeasonStats.receptions
                    }
                  />

                  <ModalStatistic
                    label="Yards"
                    value={formatNumber(
                      modalSeasonStats
                        .receivingYards,
                    )}
                  />

                  <ModalStatistic
                    label="Touchdowns"
                    value={
                      modalSeasonStats
                        .receivingTouchdowns
                    }
                  />
                </div>
              </section>

              <section className="stats-modal-category">
                <h4>Combined production</h4>

                <div className="stats-modal-stat-grid">
                  <ModalStatistic
                    label="Total yards"
                    value={formatNumber(
                      modalSeasonStats.totalYards,
                    )}
                  />

                  <ModalStatistic
                    label="Total touchdowns"
                    value={
                      modalSeasonStats
                        .totalTouchdowns
                    }
                  />

                  <ModalStatistic
                    label="Position finish"
                    value={
                      `${modalSeasonStats.position}`
                      + `${modalSeasonStats.positionRank}`
                    }
                  />
                </div>
              </section>
            </div>

            <section className="stats-modal-history">
              <div className="stats-modal-section-heading">
                <div>
                  <p className="eyebrow">
                    Season history
                  </p>

                  <h4>Year-by-year results</h4>
                </div>

                {selectedHistory && (
                  <span>
                    {
                      selectedHistory.summary
                        .seasonsPlayed
                    }{" "}
                    seasons ·{" "}
                    {
                      selectedHistory.summary
                        .totalGames
                    }{" "}
                    games
                  </span>
                )}
              </div>

              {isHistoryLoading && (
                <p
                  aria-live="polite"
                  className="stats-modal-status"
                >
                  Loading complete player history...
                </p>
              )}

              {historyErrorMessage && (
                <p
                  aria-live="polite"
                  className="stats-modal-status stats-error"
                >
                  {historyErrorMessage}
                </p>
              )}

              {selectedHistory && (
                <>
                  <div className="stats-modal-career-summary">
                    <ModalStatistic
                      label="Total half-PPR"
                      value={
                        selectedHistory.summary
                          .totalHalfPprPoints
                          .toFixed(1)
                      }
                    />

                    <ModalStatistic
                      label="Career PPG"
                      value={
                        selectedHistory.summary
                          .averagePointsPerGame
                          .toFixed(1)
                      }
                    />

                    <ModalStatistic
                      label="Best season"
                      value={
                        selectedHistory.summary
                          .bestSeason
                        ?? "—"
                      }
                    />

                    <ModalStatistic
                      label="Best-season points"
                      value={
                        selectedHistory.summary
                          .bestSeasonPoints
                          .toFixed(1)
                      }
                    />
                  </div>

                  <div className="stats-modal-season-list">
                    {selectedHistory.seasons.map(
                      (season) => (
                        <article
                          className={
                            season.season
                            === selectedSeason
                              ? "active-modal-season"
                              : ""
                          }
                          key={
                            `${season.season}-`
                            + season.gsisId
                          }
                        >
                          <strong>
                            {season.season}
                          </strong>

                          <span>
                            #{season.rank} finish
                          </span>

                          <span>
                            {season.games} games
                          </span>

                          <span>
                            {season.halfPprPoints
                              .toFixed(1)}{" "}
                            points
                          </span>

                          <span>
                            {season.pointsPerGame
                              .toFixed(1)}{" "}
                            PPG
                          </span>

                          <span>
                            {formatNumber(
                              season.totalYards,
                            )}{" "}
                            yards
                          </span>

                          <span>
                            {season.totalTouchdowns} TD
                          </span>

                          <span>
                            {season.position}
                            {season.positionRank}
                          </span>
                        </article>
                      ),
                    )}
                  </div>
                </>
              )}
            </section>
          </section>
        </div>
      )}
    </section>
  );
}

export default StatsPage;
