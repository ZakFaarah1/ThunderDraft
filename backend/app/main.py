from app.services.draft_players import get_draft_players
from app.services.draft_state import (
    delete_draft_state,
    get_draft_state,
    initialize_draft_state_database,
    save_draft_state,
)
from app.models.draft import DraftPlayerListResponse
from app.models.draft_state import (
    DraftStateDeleteResponse,
    DraftStateResponse,
    DraftStateUpsert,
)
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.logging_config import configure_application_logging
from app.models.monitoring import PlayerCacheStatusResponse
from app.models.player import PlayerListResponse
from app.models.stats import (
    PlayerHistoryResponse,
    PlayerStatsListResponse,
)
from app.services.player_stats import (
    get_player_history,
    get_player_stats,
)
from app.services.player_status import get_player_cache_status
from app.services.sleeper import get_nfl_players


logger = configure_application_logging()


# Logs when the ThunderDraft backend starts and stops.
@asynccontextmanager
async def lifespan(
    app: FastAPI,
) -> AsyncIterator[None]:
    """Logs application startup and shutdown events."""

    initialize_draft_state_database()

    logger.info(
        "draft_state_database_ready",
    )

    logger.info(
        "application_started version=0.5.0",
    )

    yield

    logger.info(
        "application_stopped",
    )


app = FastAPI(
    title="ThunderDraft API",
    version="0.5.0",
    lifespan=lifespan,
)

# Allows the frontend to reach the API from approved addresses.
allowed_origins = [
    "http://10.0.0.56:5173",
    "http://100.98.93.65:5173",
    "http://localhost:5173",
    "http://10.0.0.56:5050",
    "http://100.98.93.65:5050",
    "http://localhost:5050",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Returns basic information about the ThunderDraft API.
@app.get("/")
def root() -> dict[str, str]:
    """Returns basic information about the API."""

    return {
        "name": "ThunderDraft API",
        "status": "online",
    }


# Reports whether the backend service is running.
@app.get("/api/health")
def health_check() -> dict[str, str]:
    """Reports whether the backend service is running."""

    return {
        "status": "healthy",
        "service": "thunderdraft-backend",
    }


# Reports whether the Sleeper player cache is healthy.
@app.get(
    "/api/players/status",
    response_model=PlayerCacheStatusResponse,
)
def player_cache_status() -> PlayerCacheStatusResponse:
    """Reports whether the NFL player cache exists and is current."""

    return get_player_cache_status()


# Returns cached current NFL player information.
@app.get(
    "/api/players",
    response_model=PlayerListResponse,
)
async def list_players(
    refresh: bool = Query(
        default=False,
        description="Force a refresh of the Sleeper player cache.",
    ),
) -> PlayerListResponse:
    """Returns fantasy-relevant players from the server cache."""

    return await get_nfl_players(
        force_refresh=refresh,
    )


# Returns the complete upcoming-season draft pool.
@app.get(
    "/api/draft/players",
    response_model=DraftPlayerListResponse,
)
async def list_draft_players(
    refresh: bool = Query(
        default=False,
        description=(
            "Force a refresh of Sleeper and "
            "the 2026 ADP source."
        ),
    ),
) -> DraftPlayerListResponse:
    """Returns all draftable players with optional market ADP."""

    return await get_draft_players(
        force_refresh=refresh,
    )


# Returns the active persisted fantasy draft.
@app.get(
    "/api/draft/state",
    response_model=DraftStateResponse,
)
def read_draft_state() -> DraftStateResponse:
    """Returns the active saved draft snapshot."""

    return get_draft_state()


# Creates or replaces the active persisted fantasy draft.
@app.put(
    "/api/draft/state",
    response_model=DraftStateResponse,
)
def write_draft_state(
    state: DraftStateUpsert,
) -> DraftStateResponse:
    """Saves the active draft snapshot."""

    try:
        return save_draft_state(
            state,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error


# Deletes the active persisted fantasy draft.
@app.delete(
    "/api/draft/state",
    response_model=DraftStateDeleteResponse,
)
def clear_draft_state() -> DraftStateDeleteResponse:
    """Deletes the active saved draft snapshot."""

    return delete_draft_state()


# Returns ranked half-PPR statistics for one selected season.
@app.get(
    "/api/stats/players",
    response_model=PlayerStatsListResponse,
)
async def list_player_stats(
    season: int = Query(
        default=2025,
        description="Regular season to display: 2022 through 2025.",
    ),
    refresh: bool = Query(
        default=False,
        description="Force a refresh of the selected season's data.",
    ),
) -> PlayerStatsListResponse:
    """Returns searchable player statistics for one season."""

    return await get_player_stats(
        season=season,
        force_refresh=refresh,
    )


# Returns a player's available statistics from 2022 through 2025.
@app.get(
    "/api/stats/players/{gsis_id}/history",
    response_model=PlayerHistoryResponse,
)
async def player_history(
    gsis_id: str,
    refresh: bool = Query(
        default=False,
        description="Force a refresh of all four seasons.",
    ),
) -> PlayerHistoryResponse:
    """Returns a player's multi-season performance history."""

    return await get_player_history(
        gsis_id=gsis_id,
        force_refresh=refresh,
    )
