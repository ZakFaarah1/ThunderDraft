from typing import Any

from app.models.monitoring import PlayerCacheStatusResponse
from app.services.sleeper import (
    CACHE_FILE,
    CACHE_TTL,
    get_utc_now,
    is_cache_fresh,
    normalize_player,
    read_cache,
)


def count_normalized_players(
    raw_players: dict[str, Any],
) -> int:
    """Counts fantasy-relevant players in the cached dataset."""

    player_count = 0

    for player_id, raw_player in raw_players.items():
        normalized_player = normalize_player(
            str(player_id),
            raw_player,
        )

        if normalized_player is not None:
            player_count += 1

    return player_count


def get_player_cache_status() -> PlayerCacheStatusResponse:
    """Returns NFL cache health without refreshing external data."""

    cached_result = read_cache()

    # Reports a missing or unreadable cache without calling Sleeper.
    if cached_result is None:
        return PlayerCacheStatusResponse(
            status="missing",
            source="sleeper",
            playerCount=0,
            cachedAt=None,
            cacheExpiresAt=None,
            cacheAgeSeconds=None,
            stale=True,
            cacheFileExists=CACHE_FILE.exists(),
        )

    raw_players, cached_at = cached_result
    current_time = get_utc_now()

    # Calculates how long the current cache has existed.
    cache_age_seconds = max(
        0,
        int(
            (
                current_time -
                cached_at
            ).total_seconds(),
        ),
    )

    stale = not is_cache_fresh(
        cached_at,
    )

    return PlayerCacheStatusResponse(
        status=(
            "stale"
            if stale
            else "healthy"
        ),
        source="sleeper",
        playerCount=count_normalized_players(
            raw_players,
        ),
        cachedAt=cached_at,
        cacheExpiresAt=(
            cached_at +
            CACHE_TTL
        ),
        cacheAgeSeconds=cache_age_seconds,
        stale=stale,
        cacheFileExists=CACHE_FILE.exists(),
    )
