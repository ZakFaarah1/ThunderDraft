import asyncio
import csv
import io
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter

import httpx
from fastapi import HTTPException

from app.models.player import NflPlayer
from app.models.stats import (
    PlayerHistoryResponse,
    PlayerHistorySummary,
    PlayerSeasonStats,
    PlayerStatsListResponse,
)
from app.services.sleeper import (
    CACHE_DIRECTORY,
    get_nfl_players,
    get_utc_now,
)


logger = logging.getLogger(
    "thunderdraft.stats",
)

AVAILABLE_SEASONS = [
    2025,
    2024,
    2023,
    2022,
]

STATS_CACHE_TTL = timedelta(
    days=7,
)

stats_cache_locks = {
    season: asyncio.Lock()
    for season in AVAILABLE_SEASONS
}


# Builds the nflverse download URL for one season.
def get_stats_url(
    season: int,
) -> str:
    """Returns the nflverse player-summary URL for one season."""

    return (
        "https://github.com/nflverse/"
        "nflverse-data/releases/download/"
        "stats_player/"
        f"stats_player_reg_{season}.csv"
    )


# Builds the persistent cache path for one season.
def get_stats_cache_file(
    season: int,
) -> Path:
    """Returns the cache file used for one season."""

    return (
        CACHE_DIRECTORY
        / f"stats_player_reg_{season}.csv"
    )


# Confirms that the requested season is supported.
def validate_season(
    season: int,
) -> None:
    """Raises a client error when a season is unavailable."""

    if season not in AVAILABLE_SEASONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported season. Available seasons: "
                + ", ".join(
                    str(value)
                    for value in AVAILABLE_SEASONS
                )
            ),
        )


# Converts the first usable CSV value into a number.
def get_float(
    row: dict[str, str],
    *column_names: str,
) -> float:
    """Returns the first valid numeric value from several columns."""

    for column_name in column_names:
        raw_value = row.get(
            column_name,
        )

        if raw_value in {
            None,
            "",
            "NA",
            "NaN",
        }:
            continue

        try:
            return float(
                raw_value,
            )
        except ValueError:
            continue

    return 0.0


# Converts the first usable CSV value into an integer.
def get_integer(
    row: dict[str, str],
    *column_names: str,
) -> int:
    """Returns the first valid integer from several columns."""

    return int(
        get_float(
            row,
            *column_names,
        ),
    )


# Reads one season from the persistent cache.
def read_stats_cache(
    season: int,
) -> tuple[str, datetime] | None:
    """Returns cached CSV text and its modification time."""

    cache_file = get_stats_cache_file(
        season,
    )

    if not cache_file.exists():
        return None

    try:
        csv_text = cache_file.read_text(
            encoding="utf-8-sig",
        )

        cached_at = datetime.fromtimestamp(
            cache_file.stat().st_mtime,
            tz=timezone.utc,
        )

        return (
            csv_text,
            cached_at,
        )
    except OSError:
        logger.exception(
            "nfl_stats_cache_read_failed season=%s file=%s",
            season,
            cache_file,
        )

        return None


# Determines whether one season's cache is still current.
def is_stats_cache_fresh(
    cached_at: datetime,
) -> bool:
    """Returns whether the cache is younger than its TTL."""

    return (
        get_utc_now() - cached_at
        < STATS_CACHE_TTL
    )


# Writes one season's CSV using a temporary file.
def write_stats_cache(
    season: int,
    csv_text: str,
) -> datetime:
    """Persists one season's downloaded statistics."""

    CACHE_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    cache_file = get_stats_cache_file(
        season,
    )

    temporary_file = Path(
        f"{cache_file}.tmp",
    )

    temporary_file.write_text(
        csv_text,
        encoding="utf-8",
    )

    temporary_file.replace(
        cache_file,
    )

    return datetime.fromtimestamp(
        cache_file.stat().st_mtime,
        tz=timezone.utc,
    )


# Downloads one season from nflverse.
async def download_stats_csv(
    season: int,
) -> str:
    """Downloads one regular-season player-summary CSV."""

    async with httpx.AsyncClient(
        timeout=60.0,
        follow_redirects=True,
    ) as client:
        response = await client.get(
            get_stats_url(
                season,
            ),
        )

        response.raise_for_status()

        return response.text


# Returns fresh or cached CSV data for one season.
async def get_stats_csv(
    season: int,
    force_refresh: bool = False,
) -> tuple[str, datetime, bool]:
    """Returns CSV text, cache time, and stale state."""

    validate_season(
        season,
    )

    cached_result = read_stats_cache(
        season,
    )

    if (
        cached_result
        and not force_refresh
        and is_stats_cache_fresh(
            cached_result[1],
        )
    ):
        logger.info(
            (
                "nfl_stats_cache_hit "
                "season=%s age_seconds=%s"
            ),
            season,
            int(
                (
                    get_utc_now()
                    - cached_result[1]
                ).total_seconds(),
            ),
        )

        return (
            cached_result[0],
            cached_result[1],
            False,
        )

    async with stats_cache_locks[
        season
    ]:
        cached_result = read_stats_cache(
            season,
        )

        # Checks again after obtaining the season lock.
        if (
            cached_result
            and not force_refresh
            and is_stats_cache_fresh(
                cached_result[1],
            )
        ):
            return (
                cached_result[0],
                cached_result[1],
                False,
            )

        refresh_started = perf_counter()

        logger.info(
            (
                "nfl_stats_refresh_started "
                "season=%s force_refresh=%s"
            ),
            season,
            force_refresh,
        )

        try:
            csv_text = await download_stats_csv(
                season,
            )

            cached_at = write_stats_cache(
                season,
                csv_text,
            )

            logger.info(
                (
                    "nfl_stats_refresh_succeeded "
                    "season=%s duration_ms=%s bytes=%s"
                ),
                season,
                round(
                    (
                        perf_counter()
                        - refresh_started
                    ) * 1000,
                    2,
                ),
                len(
                    csv_text.encode(
                        "utf-8",
                    ),
                ),
            )

            return (
                csv_text,
                cached_at,
                False,
            )
        except (
            httpx.HTTPError,
            OSError,
        ) as error:
            # Uses older data when a refresh fails.
            if cached_result:
                logger.warning(
                    (
                        "nfl_stats_stale_cache_used "
                        "season=%s error_type=%s error=%s"
                    ),
                    season,
                    type(error).__name__,
                    error,
                    exc_info=True,
                )

                return (
                    cached_result[0],
                    cached_result[1],
                    True,
                )

            logger.exception(
                (
                    "nfl_stats_refresh_failed "
                    "season=%s no_cache_available=true"
                ),
                season,
            )

            raise HTTPException(
                status_code=503,
                detail=(
                    f"Statistics for {season} are "
                    "temporarily unavailable."
                ),
            ) from error


# Indexes one season's rows by cleaned GSIS ID.
def build_stats_lookup(
    csv_text: str,
) -> dict[str, dict[str, str]]:
    """Returns fantasy-relevant stats indexed by GSIS ID."""

    reader = csv.DictReader(
        io.StringIO(
            csv_text,
        ),
    )

    if not reader.fieldnames:
        raise ValueError(
            "The stats CSV has no column headers.",
        )

    if "player_id" not in reader.fieldnames:
        raise ValueError(
            "The stats CSV does not contain player_id.",
        )

    stats_lookup: dict[
        str,
        dict[str, str],
    ] = {}

    for row in reader:
        gsis_id = (
            row.get(
                "player_id",
                "",
            ).strip()
        )

        position = (
            row.get(
                "position",
                "",
            ).strip()
        )

        if (
            not gsis_id
            or position
            not in {
                "QB",
                "RB",
                "WR",
                "TE",
            }
        ):
            continue

        existing_row = stats_lookup.get(
            gsis_id,
        )

        # Keeps the more complete row if duplicates are present.
        if (
            existing_row is None
            or get_integer(
                row,
                "games",
            )
            > get_integer(
                existing_row,
                "games",
            )
        ):
            stats_lookup[
                gsis_id
            ] = row

    return stats_lookup


# Normalizes a name for safe fallback matching.
def normalize_player_name(
    name: str,
) -> str:
    """Removes punctuation and spacing from a player name."""

    return "".join(
        character
        for character in name.lower()
        if character.isalnum()
    )


# Builds Sleeper lookups for optional enrichment.
def build_sleeper_indexes(
    current_players: list[NflPlayer],
) -> tuple[
    dict[str, NflPlayer],
    dict[tuple[str, str], NflPlayer],
]:
    """Indexes players by GSIS ID and unique name-position."""

    players_by_gsis: dict[str, NflPlayer] = {}
    players_by_name_position: dict[
        tuple[str, str],
        NflPlayer,
    ] = {}

    ambiguous_name_keys: set[
        tuple[str, str]
    ] = set()

    for player in current_players:
        if player.gsisId:
            players_by_gsis[
                player.gsisId.strip()
            ] = player

        name_key = (
            normalize_player_name(
                player.name,
            ),
            player.position,
        )

        existing_player = players_by_name_position.get(
            name_key,
        )

        # Prevents unsafe fallback matches when names collide.
        if (
            existing_player is not None
            and existing_player.id != player.id
        ):
            ambiguous_name_keys.add(
                name_key,
            )
        else:
            players_by_name_position[
                name_key
            ] = player

    for name_key in ambiguous_name_keys:
        players_by_name_position.pop(
            name_key,
            None,
        )

    return (
        players_by_gsis,
        players_by_name_position,
    )


# Finds optional Sleeper details for an nflverse player.
def find_sleeper_player(
    gsis_id: str,
    row: dict[str, str],
    players_by_gsis: dict[str, NflPlayer],
    players_by_name_position: dict[
        tuple[str, str],
        NflPlayer,
    ],
) -> NflPlayer | None:
    """Matches by GSIS ID first and unique name second."""

    direct_match = players_by_gsis.get(
        gsis_id,
    )

    if direct_match is not None:
        return direct_match

    stats_name = (
        row.get("player_display_name")
        or row.get("player_name")
        or ""
    ).strip()

    stats_position = (
        row.get("position")
        or ""
    ).strip()

    if not stats_name or not stats_position:
        return None

    return players_by_name_position.get(
        (
            normalize_player_name(
                stats_name,
            ),
            stats_position,
        ),
    )


# Chooses the historical or current team.
def get_player_team(
    player: NflPlayer | None,
    row: dict[str, str],
) -> str:
    """Returns the best available team abbreviation."""

    stats_team = (
        row.get("recent_team")
        or row.get("team")
        or ""
    ).strip()

    if stats_team:
        return stats_team

    if player is not None:
        return player.nflTeam

    return "FA"


# Converts an nflverse row into the frontend format.
def build_player_stats(
    player: NflPlayer | None,
    row: dict[str, str],
    season: int,
) -> PlayerSeasonStats:
    """Builds stats while treating Sleeper details as optional."""

    gsis_id = (
        row.get("player_id")
        or ""
    ).strip()

    stats_name = (
        row.get("player_display_name")
        or row.get("player_name")
        or gsis_id
    ).strip()

    stats_position = (
        row.get("position")
        or (
            player.position
            if player is not None
            else ""
        )
    ).strip()

    games = get_integer(
        row,
        "games",
    )

    passing_yards = get_integer(
        row,
        "passing_yards",
    )

    rushing_yards = get_integer(
        row,
        "rushing_yards",
    )

    receiving_yards = get_integer(
        row,
        "receiving_yards",
    )

    passing_touchdowns = get_integer(
        row,
        "passing_tds",
    )

    rushing_touchdowns = get_integer(
        row,
        "rushing_tds",
    )

    receiving_touchdowns = get_integer(
        row,
        "receiving_tds",
    )

    receptions = get_integer(
        row,
        "receptions",
    )

    standard_points = get_float(
        row,
        "fantasy_points",
    )

    half_ppr_points = round(
        standard_points + receptions * 0.5,
        2,
    )

    points_per_game = round(
        half_ppr_points / games
        if games
        else 0.0,
        2,
    )

    return PlayerSeasonStats(
        id=(
            player.id
            if player is not None
            else gsis_id
        ),
        gsisId=gsis_id,
        name=stats_name,
        position=stats_position,
        nflTeam=get_player_team(
            player,
            row,
        ),
        imageUrl=(
            player.imageUrl
            if player is not None
            else None
        ),
        fallbackImageUrl=(
            player.fallbackImageUrl
            if player is not None
            else None
        ),
        injuryStatus=(
            player.injuryStatus
            if player is not None
            else None
        ),
        season=season,
        games=games,
        rank=0,
        positionRank=0,
        halfPprPoints=half_ppr_points,
        pointsPerGame=points_per_game,
        passingCompletions=get_integer(
            row,
            "completions",
        ),
        passingAttempts=get_integer(
            row,
            "attempts",
        ),
        passingYards=passing_yards,
        passingTouchdowns=passing_touchdowns,
        passingInterceptions=get_integer(
            row,
            "passing_interceptions",
            "interceptions",
        ),
        carries=get_integer(
            row,
            "carries",
        ),
        rushingYards=rushing_yards,
        rushingTouchdowns=rushing_touchdowns,
        targets=get_integer(
            row,
            "targets",
        ),
        receptions=receptions,
        receivingYards=receiving_yards,
        receivingTouchdowns=receiving_touchdowns,
        totalYards=(
            passing_yards
            + rushing_yards
            + receiving_yards
        ),
        totalTouchdowns=(
            passing_touchdowns
            + rushing_touchdowns
            + receiving_touchdowns
        ),
    )


# Sorts one season and assigns overall and position ranks.
def rank_player_stats(
    players: list[PlayerSeasonStats],
) -> list[PlayerSeasonStats]:
    """Ranks players by half-PPR production."""

    players.sort(
        key=lambda player: (
            -player.halfPprPoints,
            -player.pointsPerGame,
            player.name,
        ),
    )

    position_counts: dict[str, int] = {}

    for overall_rank, player in enumerate(
        players,
        start=1,
    ):
        position_counts[
            player.position
        ] = (
            position_counts.get(
                player.position,
                0,
            )
            + 1
        )

        player.rank = overall_rank
        player.positionRank = position_counts[
            player.position
        ]

    return players


# Keeps every nflverse player and optionally enriches them.
def merge_season_players(
    current_players: list[NflPlayer],
    stats_lookup: dict[str, dict[str, str]],
    season: int,
) -> list[PlayerSeasonStats]:
    """Keeps every nflverse player who recorded a game."""

    (
        players_by_gsis,
        players_by_name_position,
    ) = build_sleeper_indexes(
        current_players,
    )

    merged_players: list[
        PlayerSeasonStats
    ] = []

    for gsis_id, stats_row in stats_lookup.items():
        sleeper_player = find_sleeper_player(
            gsis_id,
            stats_row,
            players_by_gsis,
            players_by_name_position,
        )

        player_stats = build_player_stats(
            sleeper_player,
            stats_row,
            season,
        )

        if player_stats.games <= 0:
            continue

        merged_players.append(
            player_stats,
        )

    return rank_player_stats(
        merged_players,
    )


# Loads one selected season for the Stats table.
async def get_player_stats(
    season: int = 2025,
    force_refresh: bool = False,
) -> PlayerStatsListResponse:
    """Returns ranked current players for one season."""

    validate_season(
        season,
    )

    csv_text, cached_at, stats_stale = (
        await get_stats_csv(
            season,
            force_refresh=force_refresh,
        )
    )

    sleeper_response = await get_nfl_players(
        force_refresh=force_refresh,
    )

    try:
        stats_lookup = build_stats_lookup(
            csv_text,
        )
    except (
        csv.Error,
        ValueError,
    ) as error:
        logger.exception(
            "nfl_stats_parse_failed season=%s",
            season,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                f"Statistics for {season} could "
                "not be processed."
            ),
        ) from error

    ranked_players = merge_season_players(
        sleeper_response.players,
        stats_lookup,
        season,
    )

    logger.info(
        (
            "nfl_stats_response_built "
            "season=%s player_count=%s"
        ),
        season,
        len(
            ranked_players,
        ),
    )

    return PlayerStatsListResponse(
        source="nflverse+sleeper",
        selectedSeason=season,
        availableSeasons=AVAILABLE_SEASONS,
        playerCount=len(
            ranked_players,
        ),
        cachedAt=cached_at,
        cacheExpiresAt=(
            cached_at
            + STATS_CACHE_TTL
        ),
        stale=(
            stats_stale
            or sleeper_response.stale
        ),
        players=ranked_players,
    )


# Calculates the totals and averages shown in player history.
def build_history_summary(
    seasons: list[PlayerSeasonStats],
) -> PlayerHistorySummary:
    """Builds simple multi-season totals and averages."""

    total_games = sum(
        season.games
        for season in seasons
    )

    total_points = round(
        sum(
            season.halfPprPoints
            for season in seasons
        ),
        2,
    )

    best_season_record = max(
        seasons,
        key=lambda season: season.halfPprPoints,
        default=None,
    )

    return PlayerHistorySummary(
        seasonsPlayed=len(
            seasons,
        ),
        totalGames=total_games,
        totalHalfPprPoints=total_points,
        averagePointsPerSeason=round(
            (
                total_points
                / len(
                    seasons,
                )
            )
            if seasons
            else 0.0,
            2,
        ),
        averagePointsPerGame=round(
            (
                total_points
                / total_games
            )
            if total_games
            else 0.0,
            2,
        ),
        bestSeason=(
            best_season_record.season
            if best_season_record
            else None
        ),
        bestSeasonPoints=(
            best_season_record.halfPprPoints
            if best_season_record
            else 0.0
        ),
    )


# Loads all available seasons for one nflverse player.
async def get_player_history(
    gsis_id: str,
    force_refresh: bool = False,
) -> PlayerHistoryResponse:
    """Returns all available history without requiring a Sleeper match."""

    cleaned_gsis_id = gsis_id.strip()

    if not cleaned_gsis_id:
        raise HTTPException(
            status_code=404,
            detail="Player was not found.",
        )

    sleeper_response = await get_nfl_players(
        force_refresh=force_refresh,
    )

    # Uses Sleeper only as optional current-player enrichment.
    current_player = next(
        (
            player
            for player in sleeper_response.players
            if player.gsisId == cleaned_gsis_id
        ),
        None,
    )

    season_results = await asyncio.gather(
        *[
            get_stats_csv(
                season,
                force_refresh=force_refresh,
            )
            for season in AVAILABLE_SEASONS
        ],
    )

    history: list[
        PlayerSeasonStats
    ] = []

    # Keeps every matching nflverse season even without Sleeper data.
    for season, result in zip(
        AVAILABLE_SEASONS,
        season_results,
        strict=True,
    ):
        csv_text = result[0]

        try:
            stats_lookup = build_stats_lookup(
                csv_text,
            )
        except (
            csv.Error,
            ValueError,
        ) as error:
            logger.exception(
                "nfl_stats_parse_failed season=%s",
                season,
            )

            raise HTTPException(
                status_code=503,
                detail=(
                    "Player history could not "
                    "be processed."
                ),
            ) from error

        stats_row = stats_lookup.get(
            cleaned_gsis_id,
        )

        if stats_row is None:
            continue

        player_stats = build_player_stats(
            current_player,
            stats_row,
            season,
        )

        if player_stats.games > 0:
            history.append(
                player_stats,
            )

    if not history:
        raise HTTPException(
            status_code=404,
            detail="Player history was not found.",
        )

    # Assigns each record its true seasonal and positional rank.
    for season_record in history:
        season_response = await get_player_stats(
            season=season_record.season,
            force_refresh=False,
        )

        ranked_record = next(
            (
                player
                for player in season_response.players
                if player.gsisId
                == cleaned_gsis_id
            ),
            None,
        )

        if ranked_record is not None:
            season_record.rank = (
                ranked_record.rank
            )

            season_record.positionRank = (
                ranked_record.positionRank
            )

    history.sort(
        key=lambda season_record: season_record.season,
        reverse=True,
    )

    latest_record = history[0]

    logger.info(
        (
            "nfl_player_history_built "
            "gsis_id=%s season_count=%s"
        ),
        cleaned_gsis_id,
        len(
            history,
        ),
    )

    return PlayerHistoryResponse(
        id=(
            current_player.id
            if current_player
            else cleaned_gsis_id
        ),
        gsisId=cleaned_gsis_id,
        name=(
            current_player.name
            if current_player
            else latest_record.name
        ),
        position=latest_record.position,
        nflTeam=(
            current_player.nflTeam
            if (
                current_player
                and current_player.nflTeam
            )
            else latest_record.nflTeam
        ),
        imageUrl=(
            current_player.imageUrl
            if current_player
            else latest_record.imageUrl
        ),
        fallbackImageUrl=(
            current_player.fallbackImageUrl
            if current_player
            else latest_record.fallbackImageUrl
        ),
        injuryStatus=(
            current_player.injuryStatus
            if current_player
            else latest_record.injuryStatus
        ),
        availableSeasons=[
            season_record.season
            for season_record in history
        ],
        summary=build_history_summary(
            history,
        ),
        seasons=history,
    )
