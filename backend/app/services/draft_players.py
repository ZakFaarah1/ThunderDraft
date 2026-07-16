import asyncio
import csv
import json
import logging
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException

from app.models.draft import (
    DraftPlayer,
    DraftPlayerListResponse,
)
from app.models.player import NflPlayer
from app.services.player_stats import (
    AVAILABLE_SEASONS,
    build_stats_lookup,
    get_stats_csv,
)
from app.services.sleeper import get_nfl_players


logger = logging.getLogger(
    "thunderdraft.draft_players",
)

ADP_CACHE_TTL = timedelta(hours=6)
DRAFT_TEAM_COUNT = 12
DRAFT_SCORING_FORMAT = "half-ppr"

SUPPORTED_POSITIONS = {
    "QB",
    "RB",
    "WR",
    "TE",
    "K",
    "DST",
}

VETERAN_SEARCH_RANK_CUTOFF = 500
ROOKIE_SEARCH_RANK_CUTOFF = 500

ROOKIE_DEPTH_LIMITS = {
    "QB": 3,
    "RB": 4,
    "WR": 4,
    "TE": 4,
    "K": 1,
}

ROOKIE_ROLE_POINTS = {
    "QB": {
        1: 250.0,
        2: 65.0,
        3: 25.0,
    },
    "RB": {
        1: 180.0,
        2: 125.0,
        3: 80.0,
        4: 45.0,
    },
    "WR": {
        1: 175.0,
        2: 130.0,
        3: 90.0,
        4: 55.0,
    },
    "TE": {
        1: 135.0,
        2: 90.0,
        3: 55.0,
        4: 35.0,
    },
    "K": {
        1: 115.0,
    },
}

ROOKIE_POSITION_MODELS = {
    "QB": (320.0, 1.10, 20.0),
    "RB": (240.0, 0.95, 15.0),
    "WR": (230.0, 0.80, 15.0),
    "TE": (180.0, 0.55, 10.0),
    "K": (125.0, 0.15, 75.0),
}

POSITION_ALIASES = {
    "DEF": "DST",
    "D/ST": "DST",
    "PK": "K",
}

TEAM_ALIASES = {
    "JAC": "JAX",
    "LA": "LAR",
    "OAK": "LV",
    "SD": "LAC",
    "STL": "LAR",
}

NAME_SUFFIXES = {
    "jr",
    "sr",
    "ii",
    "iii",
    "iv",
    "v",
}

_adp_cache_lock = asyncio.Lock()


# Returns the configured upcoming fantasy season.
def get_draft_season() -> int:
    """Loads the draft season from the environment."""

    configured_season = os.getenv(
        "THUNDERDRAFT_DRAFT_SEASON",
        "2026",
    )

    try:
        return int(configured_season)
    except ValueError:
        logger.warning(
            "invalid_draft_season value=%s",
            configured_season,
        )

        return 2026


# Creates and returns the persistent cache directory.
def get_cache_directory() -> Path:
    """Returns the configured ThunderDraft cache directory."""

    cache_directory = Path(
        os.getenv(
            "THUNDERDRAFT_CACHE_DIR",
            "/app/data/cache",
        ),
    )

    cache_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    return cache_directory


# Returns the cache file for one ADP season.
def get_adp_cache_file(
    season: int,
) -> Path:
    """Builds the persistent ADP cache filename."""

    return (
        get_cache_directory()
        / f"ffc_{season}_half_ppr_12.json"
    )


# Returns the free ADP URL for one season.
def get_adp_url(
    season: int,
) -> str:
    """Builds the Fantasy Football Calculator request URL."""

    return (
        "https://fantasyfootballcalculator.com/"
        "api/v1/adp/half-ppr"
        f"?teams={DRAFT_TEAM_COUNT}"
        f"&year={season}"
    )


# Converts a provider value into an optional integer.
def get_optional_int(
    value: Any,
) -> int | None:
    """Returns an integer or None for an unusable value."""

    if value is None or value == "":
        return None

    try:
        return int(float(value))
    except (
        TypeError,
        ValueError,
    ):
        return None


# Converts a provider value into an optional float.
def get_optional_float(
    value: Any,
) -> float | None:
    """Returns a float or None for an unusable value."""

    if value is None or value == "":
        return None

    try:
        return float(value)
    except (
        TypeError,
        ValueError,
    ):
        return None


# Normalizes provider-specific position labels.
def normalize_position(
    position: str | None,
) -> str:
    """Returns a comparable fantasy position."""

    cleaned_position = str(
        position or "",
    ).strip().upper()

    return POSITION_ALIASES.get(
        cleaned_position,
        cleaned_position,
    )


# Normalizes historical and current team abbreviations.
def normalize_team(
    team: str | None,
) -> str:
    """Returns a comparable NFL team abbreviation."""

    cleaned_team = str(
        team or "",
    ).strip().upper()

    return TEAM_ALIASES.get(
        cleaned_team,
        cleaned_team,
    )


# Normalizes a player's name for cross-provider matching.
def normalize_player_name(
    player_name: str | None,
) -> str:
    """Removes accents, punctuation, spacing, and suffixes."""

    normalized_name = unicodedata.normalize(
        "NFKD",
        str(player_name or ""),
    )

    ascii_name = normalized_name.encode(
        "ascii",
        "ignore",
    ).decode(
        "ascii",
    )

    name_parts = re.findall(
        r"[a-z0-9]+",
        ascii_name.lower(),
    )

    while (
        name_parts
        and name_parts[-1] in NAME_SUFFIXES
    ):
        name_parts.pop()

    return " ".join(name_parts)


# Chooses one normalized fantasy position for a player.
def get_player_position(
    player: NflPlayer,
) -> str:
    """Returns the player's primary draft position."""

    primary_position = normalize_position(
        player.position,
    )

    if primary_position in SUPPORTED_POSITIONS:
        return primary_position

    for fantasy_position in player.fantasyPositions:
        normalized_position = normalize_position(
            fantasy_position,
        )

        if normalized_position in SUPPORTED_POSITIONS:
            return normalized_position

    return primary_position


# Determines whether a player belongs to a current NFL team.
def has_current_team(
    player: NflPlayer,
) -> bool:
    """Excludes blank and free-agent player records."""

    team = normalize_team(
        player.nflTeam,
    )

    return team not in {
        "",
        "FA",
    }


# Determines whether Sleeper identifies the player as a rookie.
def is_rookie(
    player: NflPlayer,
) -> bool:
    """Returns True for a zero-experience player."""

    return player.yearsExperience == 0


# Returns a safe numeric version of Sleeper search rank.
def get_search_rank(
    player: NflPlayer,
) -> int:
    """Uses a large fallback for missing rankings."""

    if player.searchRank is None:
        return 9999999

    return player.searchRank


# Determines whether a rookie has a relevant depth-chart role.
def has_relevant_rookie_role(
    player: NflPlayer,
) -> bool:
    """Applies position-specific depth-chart limits."""

    position = get_player_position(
        player,
    )

    depth_limit = ROOKIE_DEPTH_LIMITS.get(
        position,
    )

    return (
        depth_limit is not None
        and player.depthChartOrder is not None
        and player.depthChartOrder <= depth_limit
    )


# Determines whether a Sleeper record is a valid draft candidate.
def is_draftable_player(
    player: NflPlayer,
) -> bool:
    """Keeps active, current-team fantasy players."""

    return (
        player.active
        and has_current_team(player)
        and get_player_position(player)
        in SUPPORTED_POSITIONS
        and bool(player.name.strip())
    )


# Determines whether a candidate appears on the visible board.
def should_include_player(
    player: NflPlayer,
    adp_record: dict[str, Any] | None,
) -> bool:
    """Keeps market-ranked and fantasy-relevant players."""

    position = get_player_position(
        player,
    )

    if position == "DST":
        return True

    if position == "K":
        return (
            adp_record is not None
            or player.depthChartOrder == 1
            or get_search_rank(player)
            <= VETERAN_SEARCH_RANK_CUTOFF
        )

    if is_rookie(player):
        return (
            adp_record is not None
            or get_search_rank(player)
            <= ROOKIE_SEARCH_RANK_CUTOFF
            or has_relevant_rookie_role(player)
        )

    return (
        adp_record is not None
        or get_search_rank(player)
        <= VETERAN_SEARCH_RANK_CUTOFF
    )


# Returns a conservative projection baseline for a rookie's role.
def get_rookie_role_points(
    player: NflPlayer,
) -> float:
    """Maps depth-chart order to expected opportunity."""

    position = get_player_position(
        player,
    )

    position_roles = ROOKIE_ROLE_POINTS.get(
        position,
        {},
    )

    if player.depthChartOrder is None:
        return 10.0

    return position_roles.get(
        player.depthChartOrder,
        10.0,
    )


# Estimates one rookie's 2026 half-PPR production.
def estimate_rookie_projection(
    player: NflPlayer,
    adp_record: dict[str, Any] | None,
) -> tuple[
    float | None,
    str | None,
    str | None,
]:
    """Blends ADP, Sleeper rank, and depth-chart role."""

    if not is_rookie(player):
        return (
            None,
            None,
            None,
        )

    position = get_player_position(
        player,
    )

    position_model = ROOKIE_POSITION_MODELS.get(
        position,
    )

    if position_model is None:
        return (
            None,
            None,
            None,
        )

    ceiling, slope, floor = position_model

    role_points = get_rookie_role_points(
        player,
    )

    adp = (
        get_optional_float(
            adp_record.get("adp"),
        )
        if adp_record
        else None
    )

    if adp is not None:
        market_points = max(
            floor,
            ceiling - slope * adp,
        )

        estimate = (
            market_points * 0.70
            + role_points * 0.30
        )

        confidence = (
            "High"
            if player.depthChartOrder is not None
            else "Medium"
        )

        return (
            round(estimate, 1),
            "ThunderDraft rookie model v1",
            confidence,
        )

    search_rank = get_search_rank(
        player,
    )

    if search_rank <= ROOKIE_SEARCH_RANK_CUTOFF:
        rank_points = max(
            floor,
            ceiling - slope * search_rank,
        )

        estimate = (
            rank_points * 0.55
            + role_points * 0.45
        )

        confidence = (
            "Medium"
            if player.depthChartOrder is not None
            else "Low"
        )

        return (
            round(estimate, 1),
            "ThunderDraft rookie model v1",
            confidence,
        )

    return (
        round(role_points, 1),
        "ThunderDraft rookie model v1",
        "Low",
    )


# Reads an existing persistent ADP cache.
def read_adp_cache(
    season: int,
) -> tuple[
    dict[str, Any],
    datetime,
] | None:
    """Loads cached ADP data and its retrieval timestamp."""

    cache_file = get_adp_cache_file(
        season,
    )

    if not cache_file.exists():
        return None

    try:
        cache_envelope = json.loads(
            cache_file.read_text(
                encoding="utf-8",
            ),
        )

        cached_at = datetime.fromisoformat(
            cache_envelope["cachedAt"],
        )

        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(
                tzinfo=timezone.utc,
            )

        data = cache_envelope["data"]

        if not isinstance(
            data,
            dict,
        ):
            return None

        if not isinstance(
            data.get("players"),
            list,
        ):
            return None

        return (
            data,
            cached_at,
        )
    except (
        KeyError,
        TypeError,
        ValueError,
        json.JSONDecodeError,
        OSError,
    ):
        logger.exception(
            "adp_cache_read_failed season=%s",
            season,
        )

        return None


# Writes ADP data atomically to persistent storage.
def write_adp_cache(
    season: int,
    data: dict[str, Any],
    cached_at: datetime,
) -> None:
    """Stores a successfully retrieved ADP response."""

    cache_file = get_adp_cache_file(
        season,
    )

    temporary_file = cache_file.with_suffix(
        ".tmp",
    )

    cache_envelope = {
        "cachedAt": cached_at.isoformat(),
        "data": data,
    }

    temporary_file.write_text(
        json.dumps(
            cache_envelope,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    temporary_file.replace(
        cache_file,
    )


# Downloads and validates the current ADP response.
async def download_adp_data(
    season: int,
) -> dict[str, Any]:
    """Retrieves the free half-PPR ADP feed."""

    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=45,
    ) as client:
        response = await client.get(
            get_adp_url(season),
            headers={
                "Accept": "application/json",
                "User-Agent": (
                    "ThunderDraft/0.6 "
                    "personal fantasy draft assistant"
                ),
            },
        )

        response.raise_for_status()
        data = response.json()

    if not isinstance(
        data,
        dict,
    ):
        raise ValueError(
            "ADP response was not an object.",
        )

    if not isinstance(
        data.get("players"),
        list,
    ):
        raise ValueError(
            "ADP response did not contain players.",
        )

    return data


# Returns fresh ADP data or a stale cache during an outage.
async def get_adp_data(
    season: int,
    force_refresh: bool = False,
) -> tuple[
    dict[str, Any],
    datetime,
    bool,
]:
    """Loads current ADP with persistent fallback caching."""

    now = datetime.now(timezone.utc)

    cached_result = read_adp_cache(
        season,
    )

    if (
        not force_refresh
        and cached_result is not None
        and now - cached_result[1]
        < ADP_CACHE_TTL
    ):
        logger.info(
            "adp_cache_hit season=%s",
            season,
        )

        return (
            cached_result[0],
            cached_result[1],
            False,
        )

    async with _adp_cache_lock:
        now = datetime.now(timezone.utc)

        cached_result = read_adp_cache(
            season,
        )

        if (
            not force_refresh
            and cached_result is not None
            and now - cached_result[1]
            < ADP_CACHE_TTL
        ):
            return (
                cached_result[0],
                cached_result[1],
                False,
            )

        try:
            data = await download_adp_data(
                season,
            )

            cached_at = datetime.now(
                timezone.utc,
            )

            write_adp_cache(
                season,
                data,
                cached_at,
            )

            logger.info(
                (
                    "adp_download_complete "
                    "season=%s player_count=%s"
                ),
                season,
                len(data["players"]),
            )

            return (
                data,
                cached_at,
                False,
            )
        except (
            httpx.HTTPError,
            OSError,
            ValueError,
            json.JSONDecodeError,
        ) as error:
            if cached_result is not None:
                logger.warning(
                    (
                        "adp_download_failed_using_cache "
                        "season=%s error=%s"
                    ),
                    season,
                    error,
                )

                return (
                    cached_result[0],
                    cached_result[1],
                    True,
                )

            logger.exception(
                "adp_download_failed season=%s",
                season,
            )

            raise HTTPException(
                status_code=503,
                detail=(
                    "The 2026 ADP source is "
                    "temporarily unavailable."
                ),
            ) from error


# Builds matching indexes from current Sleeper players.
def build_sleeper_indexes(
    players: list[NflPlayer],
) -> tuple[
    dict[
        tuple[str, str, str],
        list[NflPlayer],
    ],
    dict[
        tuple[str, str],
        list[NflPlayer],
    ],
]:
    """Indexes players by name, position, and team."""

    exact_index: dict[
        tuple[str, str, str],
        list[NflPlayer],
    ] = {}

    name_position_index: dict[
        tuple[str, str],
        list[NflPlayer],
    ] = {}

    for player in players:
        normalized_name = normalize_player_name(
            player.name,
        )

        position = get_player_position(
            player,
        )

        team = normalize_team(
            player.nflTeam,
        )

        exact_index.setdefault(
            (
                normalized_name,
                position,
                team,
            ),
            [],
        ).append(player)

        name_position_index.setdefault(
            (
                normalized_name,
                position,
            ),
            [],
        ).append(player)

    return (
        exact_index,
        name_position_index,
    )


# Finds one unambiguous Sleeper match for an ADP record.
def find_sleeper_player(
    adp_player: dict[str, Any],
    exact_index: dict[
        tuple[str, str, str],
        list[NflPlayer],
    ],
    name_position_index: dict[
        tuple[str, str],
        list[NflPlayer],
    ],
) -> NflPlayer | None:
    """Matches team first, then a unique name-position pair."""

    normalized_name = normalize_player_name(
        adp_player.get("name"),
    )

    position = normalize_position(
        adp_player.get("position"),
    )

    team = normalize_team(
        adp_player.get("team"),
    )

    exact_matches = exact_index.get(
        (
            normalized_name,
            position,
            team,
        ),
        [],
    )

    if len(exact_matches) == 1:
        return exact_matches[0]

    fallback_matches = (
        name_position_index.get(
            (
                normalized_name,
                position,
            ),
            [],
        )
    )

    if len(fallback_matches) == 1:
        return fallback_matches[0]

    return None


# Matches provider ADP records to current Sleeper players.
def build_adp_matches(
    draftable_players: list[NflPlayer],
    adp_players: list[dict[str, Any]],
) -> tuple[
    dict[str, dict[str, Any]],
    list[str],
]:
    """Returns one ADP record for each matched player."""

    (
        exact_index,
        name_position_index,
    ) = build_sleeper_indexes(
        draftable_players,
    )

    matched_adp: dict[
        str,
        dict[str, Any],
    ] = {}

    unmatched_names: list[str] = []
    position_counts: dict[str, int] = {}

    sorted_adp_players = sorted(
        adp_players,
        key=lambda player: (
            get_optional_float(
                player.get("adp"),
            )
            if get_optional_float(
                player.get("adp"),
            )
            is not None
            else float("inf")
        ),
    )

    for market_rank, adp_player in enumerate(
        sorted_adp_players,
        start=1,
    ):
        position = normalize_position(
            adp_player.get("position"),
        )

        if position not in SUPPORTED_POSITIONS:
            continue

        position_counts[position] = (
            position_counts.get(
                position,
                0,
            )
            + 1
        )

        sleeper_player = find_sleeper_player(
            adp_player,
            exact_index,
            name_position_index,
        )

        if sleeper_player is None:
            unmatched_names.append(
                str(
                    adp_player.get(
                        "name",
                        "Unknown",
                    ),
                ),
            )

            continue

        matched_adp[
            sleeper_player.id
        ] = {
            **adp_player,
            "_marketRank": market_rank,
            "_marketPositionRank": (
                position_counts[position]
            ),
        }

    return (
        matched_adp,
        sorted(set(unmatched_names)),
    )


# Builds safe identifiers from nflverse history.
def build_historical_gsis_lookup(
    season_lookups: list[
        dict[str, dict[str, str]]
    ],
) -> dict[tuple[str, str], str]:
    """Indexes unique players by normalized name and position."""

    historical_lookup: dict[
        tuple[str, str],
        str,
    ] = {}

    ambiguous_keys: set[
        tuple[str, str]
    ] = set()

    for season_lookup in season_lookups:
        for gsis_id, row in season_lookup.items():
            player_name = (
                row.get("player_display_name")
                or row.get("player_name")
                or ""
            ).strip()

            position = (
                row.get("position")
                or ""
            ).strip()

            if (
                not player_name
                or not position
                or not gsis_id
            ):
                continue

            player_key = (
                normalize_player_name(
                    player_name,
                ),
                position,
            )

            existing_id = historical_lookup.get(
                player_key,
            )

            if (
                existing_id is not None
                and existing_id != gsis_id
            ):
                ambiguous_keys.add(
                    player_key,
                )
                continue

            historical_lookup[
                player_key
            ] = gsis_id

    for player_key in ambiguous_keys:
        historical_lookup.pop(
            player_key,
            None,
        )

    return historical_lookup


# Builds one merged API draft-player record.
def build_draft_player(
    player: NflPlayer,
    season: int,
    adp_record: dict[str, Any] | None,
    rookie_rank: int | None,
    historical_gsis_id: str | None,
) -> DraftPlayer:
    """Combines current metadata, ADP, and rookie estimates."""

    (
        projected_points,
        projection_source,
        projection_confidence,
    ) = estimate_rookie_projection(
        player,
        adp_record,
    )

    return DraftPlayer(
        id=player.id,
        name=player.name,
        nflTeam=normalize_team(
            player.nflTeam,
        ),
        position=get_player_position(
            player,
        ),
        active=player.active,
        status=player.status,
        injuryStatus=player.injuryStatus,
        depthChartPosition=(
            player.depthChartPosition
        ),
        depthChartOrder=player.depthChartOrder,
        yearsExperience=player.yearsExperience,
        isRookie=is_rookie(player),
        rookieRank=rookie_rank,
        gsisId=(
            player.gsisId
            or historical_gsis_id
        ),
        espnId=player.espnId,
        imageUrl=player.imageUrl,
        fallbackImageUrl=(
            player.fallbackImageUrl
        ),
        draftSeason=season,
        byeWeek=(
            get_optional_int(
                adp_record.get("bye"),
            )
            if adp_record
            else None
        ),
        marketRank=(
            get_optional_int(
                adp_record.get("_marketRank"),
            )
            if adp_record
            else None
        ),
        marketPositionRank=(
            get_optional_int(
                adp_record.get(
                    "_marketPositionRank",
                ),
            )
            if adp_record
            else None
        ),
        adp=(
            get_optional_float(
                adp_record.get("adp"),
            )
            if adp_record
            else None
        ),
        adpFormatted=(
            str(
                adp_record.get(
                    "adp_formatted",
                ),
            )
            if (
                adp_record
                and adp_record.get(
                    "adp_formatted",
                )
            )
            else None
        ),
        adpHigh=(
            get_optional_int(
                adp_record.get("high"),
            )
            if adp_record
            else None
        ),
        adpLow=(
            get_optional_int(
                adp_record.get("low"),
            )
            if adp_record
            else None
        ),
        adpStandardDeviation=(
            get_optional_float(
                adp_record.get("stdev"),
            )
            if adp_record
            else None
        ),
        timesDrafted=(
            get_optional_int(
                adp_record.get(
                    "times_drafted",
                ),
            )
            if adp_record
            else None
        ),
        projectedPoints=projected_points,
        projectionSource=projection_source,
        projectionConfidence=projection_confidence,
        thunderDraftRank=None,
        tier=None,
    )


# Returns the complete current player pool with optional ADP.
async def get_draft_players(
    force_refresh: bool = False,
) -> DraftPlayerListResponse:
    """Keeps every current player and overlays market ADP."""

    season = get_draft_season()

    historical_stats_results = await asyncio.gather(
        *[
            get_stats_csv(
                historical_season,
                force_refresh=force_refresh,
            )
            for historical_season
            in AVAILABLE_SEASONS
        ],
        return_exceptions=True,
    )

    historical_season_lookups: list[
        dict[str, dict[str, str]]
    ] = []

    for historical_result in historical_stats_results:
        if isinstance(
            historical_result,
            Exception,
        ):
            logger.warning(
                "draft_history_unavailable error=%s",
                historical_result,
            )
            continue

        csv_text = historical_result[0]

        try:
            historical_season_lookups.append(
                build_stats_lookup(
                    csv_text,
                ),
            )
        except (
            csv.Error,
            ValueError,
        ) as error:
            logger.warning(
                "draft_history_parse_failed error=%s",
                error,
            )

    historical_gsis_lookup = (
        build_historical_gsis_lookup(
            historical_season_lookups,
        )
    )

    sleeper_response, adp_result = (
        await asyncio.gather(
            get_nfl_players(
                force_refresh=force_refresh,
            ),
            get_adp_data(
                season=season,
                force_refresh=force_refresh,
            ),
        )
    )

    (
        adp_data,
        adp_cached_at,
        adp_stale,
    ) = adp_result

    candidate_players = [
        player
        for player in sleeper_response.players
        if is_draftable_player(player)
    ]

    adp_source_players = [
        player
        for player in adp_data.get(
            "players",
            [],
        )
        if isinstance(player, dict)
    ]

    (
        matched_adp,
        unmatched_adp_players,
    ) = build_adp_matches(
        candidate_players,
        adp_source_players,
    )

    included_players = [
        player
        for player in candidate_players
        if should_include_player(
            player,
            matched_adp.get(player.id),
        )
    ]

    rookie_players = [
        player
        for player in included_players
        if is_rookie(player)
    ]

    rookie_players.sort(
        key=lambda player: (
            matched_adp.get(player.id) is None,
            (
                get_optional_float(
                    matched_adp[player.id].get("adp"),
                )
                if player.id in matched_adp
                else float("inf")
            ),
            get_search_rank(player),
            (
                player.depthChartOrder
                if player.depthChartOrder is not None
                else 999
            ),
            player.name.lower(),
        ),
    )

    rookie_rank_by_id = {
        player.id: rank
        for rank, player in enumerate(
            rookie_players,
            start=1,
        )
    }

    search_rank_by_id = {
        player.id: get_search_rank(player)
        for player in included_players
    }

    merged_players = [
        build_draft_player(
            player=player,
            season=season,
            adp_record=matched_adp.get(
                player.id,
            ),
            rookie_rank=rookie_rank_by_id.get(
                player.id,
            ),
            historical_gsis_id=(
                historical_gsis_lookup.get(
                    (
                        normalize_player_name(
                            player.name,
                        ),
                        get_player_position(
                            player,
                        ),
                    ),
                )
            ),
        )
        for player in included_players
    ]

    merged_players.sort(
        key=lambda player: (
            player.adp is None,
            (
                player.adp
                if player.adp is not None
                else float("inf")
            ),
            search_rank_by_id.get(
                player.id,
                999999,
            ),
            player.name.lower(),
        ),
    )

    logger.info(
        (
            "draft_player_response_built "
            "season=%s player_count=%s "
            "matched_adp=%s unmatched_adp=%s"
        ),
        season,
        len(merged_players),
        len(matched_adp),
        len(unmatched_adp_players),
    )

    return DraftPlayerListResponse(
        source=(
            "sleeper+"
            "fantasyfootballcalculator"
        ),
        draftSeason=season,
        scoringFormat=DRAFT_SCORING_FORMAT,
        teamCount=DRAFT_TEAM_COUNT,
        playerCount=len(merged_players),
        rookieCount=len(rookie_players),
        projectedRookieCount=sum(
            1
            for player in merged_players
            if (
                player.isRookie
                and player.projectedPoints is not None
            )
        ),
        excludedCandidateCount=(
            len(candidate_players)
            - len(included_players)
        ),
        adpSourcePlayerCount=len(
            adp_source_players,
        ),
        matchedAdpPlayerCount=len(
            matched_adp,
        ),
        unmatchedAdpCount=len(
            unmatched_adp_players,
        ),
        unmatchedAdpPlayers=(
            unmatched_adp_players
        ),
        cachedAt=adp_cached_at,
        cacheExpiresAt=(
            adp_cached_at
            + ADP_CACHE_TTL
        ),
        stale=(
            sleeper_response.stale
            or adp_stale
        ),
        players=merged_players,
    )
