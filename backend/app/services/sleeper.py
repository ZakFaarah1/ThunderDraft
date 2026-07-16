import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter
from typing import Any

import httpx
from fastapi import HTTPException

from app.models.player import NflPlayer, PlayerListResponse

logger = logging.getLogger("thunderdraft.sleeper")


SLEEPER_PLAYERS_URL = (
    "https://api.sleeper.app/v1/players/nfl"
)

CACHE_TTL = timedelta(hours=24)

CACHE_DIRECTORY = Path(
    os.getenv(
        "THUNDERDRAFT_CACHE_DIR",
        "/app/data/cache",
    ),
)

CACHE_FILE = (
    CACHE_DIRECTORY /
    "sleeper_players.json"
)

SUPPORTED_POSITIONS = {
    "QB",
    "RB",
    "WR",
    "TE",
    "K",
    "DST",
}

POSITION_ORDER = {
    "QB": 0,
    "RB": 1,
    "WR": 2,
    "TE": 3,
    "K": 4,
    "DST": 5,
}

cache_lock = asyncio.Lock()


def get_utc_now() -> datetime:
    """Returns the current timezone-aware UTC time."""

    return datetime.now(timezone.utc)


def get_optional_string(
    value: object,
) -> str | None:
    """Converts a value into a nonempty string when possible."""

    if value is None:
        return None

    converted_value = str(value).strip()

    return converted_value or None


def get_optional_integer(
    value: object,
) -> int | None:
    """Converts numeric API values into integers safely."""

    if value is None or isinstance(value, bool):
        return None

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_position(
    raw_player: dict[str, Any],
) -> str | None:
    """Finds and normalizes a supported fantasy position."""

    raw_positions: list[object] = [
        raw_player.get("position"),
    ]

    fantasy_positions = raw_player.get(
        "fantasy_positions",
    )

    if isinstance(fantasy_positions, list):
        raw_positions.extend(fantasy_positions)

    for raw_position in raw_positions:
        if not isinstance(raw_position, str):
            continue

        normalized_position = (
            "DST"
            if raw_position == "DEF"
            else raw_position
        )

        if normalized_position in SUPPORTED_POSITIONS:
            return normalized_position

    return None


def normalize_fantasy_positions(
    raw_player: dict[str, Any],
    primary_position: str,
) -> list[str]:
    """Returns every supported fantasy position for a player."""

    normalized_positions: list[str] = []

    fantasy_positions = raw_player.get(
        "fantasy_positions",
    )

    if isinstance(fantasy_positions, list):
        for raw_position in fantasy_positions:
            if not isinstance(raw_position, str):
                continue

            normalized_position = (
                "DST"
                if raw_position == "DEF"
                else raw_position
            )

            if (
                normalized_position
                in SUPPORTED_POSITIONS
                and normalized_position
                not in normalized_positions
            ):
                normalized_positions.append(
                    normalized_position,
                )

    if primary_position not in normalized_positions:
        normalized_positions.insert(
            0,
            primary_position,
        )

    return normalized_positions


def build_player_name(
    player_id: str,
    raw_player: dict[str, Any],
) -> str:
    """Builds the most complete available player name."""

    full_name = get_optional_string(
        raw_player.get("full_name"),
    )

    if full_name:
        return full_name

    first_name = get_optional_string(
        raw_player.get("first_name"),
    )

    last_name = get_optional_string(
        raw_player.get("last_name"),
    )

    combined_name = " ".join(
        name_part
        for name_part in [
            first_name,
            last_name,
        ]
        if name_part
    )

    return combined_name or player_id


def build_sleeper_image_url(
    player_id: str,
    position: str,
) -> str | None:
    """Builds the Sleeper-style player headshot candidate URL."""

    if position == "DST":
        return None

    return (
        "https://sleepercdn.com/content/"
        f"nfl/players/{player_id}.jpg"
    )


def build_espn_image_url(
    espn_id: str | None,
    position: str,
) -> str | None:
    """Builds an ESPN headshot fallback when an ID exists."""

    if not espn_id or position == "DST":
        return None

    return (
        "https://a.espncdn.com/i/headshots/"
        f"nfl/players/full/{espn_id}.png"
    )


def normalize_player(
    player_id: str,
    raw_player: object,
) -> NflPlayer | None:
    """Converts one Sleeper record into a ThunderDraft player."""

    if not isinstance(raw_player, dict):
        return None

    position = normalize_position(
        raw_player,
    )

    if position is None:
        return None

    # Retired and permanently inactive players are excluded
    # from the draftable player directory.
    if raw_player.get("active") is False:
        return None

    espn_id = get_optional_string(
        raw_player.get("espn_id"),
    )

    raw_team = get_optional_string(
        raw_player.get("team"),
    )

    nfl_team = (
        raw_team
        or (
            player_id
            if position == "DST"
            else "FA"
        )
    )

    return NflPlayer(
        id=player_id,
        name=build_player_name(
            player_id,
            raw_player,
        ),
        firstName=get_optional_string(
            raw_player.get("first_name"),
        ),
        lastName=get_optional_string(
            raw_player.get("last_name"),
        ),
        nflTeam=nfl_team,
        position=position,
        fantasyPositions=(
            normalize_fantasy_positions(
                raw_player,
                position,
            )
        ),
        status=get_optional_string(
            raw_player.get("status"),
        ),
        active=bool(
            raw_player.get(
                "active",
                True,
            ),
        ),
        jerseyNumber=get_optional_integer(
            raw_player.get("number"),
        ),
        age=get_optional_integer(
            raw_player.get("age"),
        ),
        yearsExperience=get_optional_integer(
            raw_player.get("years_exp"),
        ),
        injuryStatus=get_optional_string(
            raw_player.get(
                "injury_status",
            ),
        ),
        depthChartPosition=get_optional_string(
            raw_player.get(
                "depth_chart_position",
            ),
        ),
        depthChartOrder=get_optional_integer(
            raw_player.get(
                "depth_chart_order",
            ),
        ),
        searchRank=get_optional_integer(
            raw_player.get("search_rank"),
        ),
        espnId=espn_id,
        imageUrl=build_sleeper_image_url(
            player_id,
            position,
        ),
        fallbackImageUrl=(
            build_espn_image_url(
                espn_id,
                position,
            )
        ),
    )


def parse_cached_at(
    value: object,
) -> datetime | None:
    """Parses the cache timestamp stored in the JSON file."""

    if not isinstance(value, str):
        return None

    try:
        parsed_time = datetime.fromisoformat(
            value,
        )
    except ValueError:
        return None

    if parsed_time.tzinfo is None:
        return parsed_time.replace(
            tzinfo=timezone.utc,
        )

    return parsed_time.astimezone(
        timezone.utc,
    )


def read_cache(
) -> tuple[dict[str, Any], datetime] | None:
    """Reads and validates the persistent player cache."""

    if not CACHE_FILE.exists():
        return None

    try:
        with CACHE_FILE.open(
            "r",
            encoding="utf-8",
        ) as cache_file:
            cached_payload = json.load(
                cache_file,
            )
    except (
        OSError,
        json.JSONDecodeError,
    ):
        return None

    if not isinstance(cached_payload, dict):
        return None

    raw_players = cached_payload.get(
        "players",
    )

    cached_at = parse_cached_at(
        cached_payload.get("cached_at"),
    )

    if (
        not isinstance(raw_players, dict)
        or cached_at is None
    ):
        return None

    return raw_players, cached_at


def is_cache_fresh(
    cached_at: datetime,
) -> bool:
    """Checks whether the cached player data is under 24 hours old."""

    return (
        get_utc_now() - cached_at
        < CACHE_TTL
    )


def write_cache(
    raw_players: dict[str, Any],
    cached_at: datetime,
) -> None:
    """Writes the downloaded player data atomically."""

    CACHE_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary_file = CACHE_FILE.with_suffix(
        ".tmp",
    )

    cache_payload = {
        "cached_at": cached_at.isoformat(),
        "players": raw_players,
    }

    with temporary_file.open(
        "w",
        encoding="utf-8",
    ) as cache_file:
        json.dump(
            cache_payload,
            cache_file,
            ensure_ascii=False,
        )

    temporary_file.replace(
        CACHE_FILE,
    )


async def download_players(
) -> dict[str, Any]:
    """Downloads the complete Sleeper NFL player directory."""

    timeout = httpx.Timeout(
        timeout=45.0,
        connect=10.0,
    )

    async with httpx.AsyncClient(
        timeout=timeout,
        follow_redirects=True,
    ) as client:
        response = await client.get(
            SLEEPER_PLAYERS_URL,
        )

        response.raise_for_status()

        response_payload = response.json()

    if not isinstance(response_payload, dict):
        raise ValueError(
            "Sleeper returned an invalid player payload.",
        )

    return response_payload


def build_player_response(
    raw_players: dict[str, Any],
    cached_at: datetime,
    stale: bool,
) -> PlayerListResponse:
    """Normalizes, sorts, and packages cached player records."""

    players: list[NflPlayer] = []

    for player_id, raw_player in raw_players.items():
        normalized_player = normalize_player(
            str(player_id),
            raw_player,
        )

        if normalized_player:
            players.append(
                normalized_player,
            )

    players.sort(
        key=lambda player: (
            POSITION_ORDER.get(
                player.position,
                99,
            ),
            (
                player.searchRank
                if player.searchRank is not None
                else 999999
            ),
            player.name,
        ),
    )

    return PlayerListResponse(
        source="sleeper",
        playerCount=len(players),
        cachedAt=cached_at,
        cacheExpiresAt=(
            cached_at + CACHE_TTL
        ),
        stale=stale,
        players=players,
    )


async def get_nfl_players(
    force_refresh: bool = False,
) -> PlayerListResponse:
    """Returns fresh or cached Sleeper NFL player data."""

    cached_result = read_cache()

    # Returns the current cache without contacting Sleeper.
    if (
        cached_result
        and not force_refresh
        and is_cache_fresh(
            cached_result[1],
        )
    ):
        cache_age_seconds = int(
            (
                get_utc_now() -
                cached_result[1]
            ).total_seconds(),
        )

        logger.info(
            (
                "nfl_player_cache_hit "
                "age_seconds=%s cache_file=%s"
            ),
            cache_age_seconds,
            CACHE_FILE,
        )

        return build_player_response(
            raw_players=cached_result[0],
            cached_at=cached_result[1],
            stale=False,
        )

    # Prevents simultaneous requests from downloading the
    # same large player file more than once.
    async with cache_lock:
        cached_result = read_cache()

        # Checks again in case another request refreshed the cache.
        if (
            cached_result
            and not force_refresh
            and is_cache_fresh(
                cached_result[1],
            )
        ):
            cache_age_seconds = int(
                (
                    get_utc_now() -
                    cached_result[1]
                ).total_seconds(),
            )

            logger.info(
                (
                    "nfl_player_cache_hit_after_lock "
                    "age_seconds=%s"
                ),
                cache_age_seconds,
            )

            return build_player_response(
                raw_players=cached_result[0],
                cached_at=cached_result[1],
                stale=False,
            )

        refresh_started = perf_counter()

        logger.info(
            (
                "nfl_player_refresh_started "
                "force_refresh=%s stale_cache_available=%s"
            ),
            force_refresh,
            cached_result is not None,
        )

        try:
            raw_players = await download_players()
            cached_at = get_utc_now()

            write_cache(
                raw_players,
                cached_at,
            )

            response = build_player_response(
                raw_players=raw_players,
                cached_at=cached_at,
                stale=False,
            )

            refresh_duration_ms = round(
                (
                    perf_counter() -
                    refresh_started
                ) * 1000,
                2,
            )

            logger.info(
                (
                    "nfl_player_refresh_succeeded "
                    "player_count=%s duration_ms=%s "
                    "cached_at=%s"
                ),
                response.playerCount,
                refresh_duration_ms,
                cached_at.isoformat(),
            )

            return response
        except (
            httpx.HTTPError,
            OSError,
            ValueError,
        ) as error:
            refresh_duration_ms = round(
                (
                    perf_counter() -
                    refresh_started
                ) * 1000,
                2,
            )

            # Uses older data instead of breaking the player board.
            if cached_result:
                logger.warning(
                    (
                        "nfl_player_stale_cache_used "
                        "duration_ms=%s error_type=%s error=%s"
                    ),
                    refresh_duration_ms,
                    type(error).__name__,
                    error,
                    exc_info=True,
                )

                return build_player_response(
                    raw_players=cached_result[0],
                    cached_at=cached_result[1],
                    stale=True,
                )

            logger.exception(
                (
                    "nfl_player_refresh_failed "
                    "duration_ms=%s no_cache_available=true"
                ),
                refresh_duration_ms,
            )

            raise HTTPException(
                status_code=503,
                detail=(
                    "NFL player data is temporarily "
                    "unavailable."
                ),
            ) from error
