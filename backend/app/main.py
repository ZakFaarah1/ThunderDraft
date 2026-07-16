from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from app.logging_config import configure_application_logging
from app.models.monitoring import PlayerCacheStatusResponse
from app.models.player import PlayerListResponse
from app.services.player_status import get_player_cache_status
from app.services.sleeper import get_nfl_players


logger = configure_application_logging()


# Logs when the ThunderDraft backend starts and stops.
@asynccontextmanager
async def lifespan(
    app: FastAPI,
) -> AsyncIterator[None]:
    """Logs application startup and shutdown events."""

    logger.info(
        "application_started version=0.4.0",
    )

    yield

    logger.info(
        "application_stopped",
    )


app = FastAPI(
    title="ThunderDraft API",
    version="0.4.0",
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


# Reports whether the NFL player cache is healthy.
@app.get(
    "/api/players/status",
    response_model=PlayerCacheStatusResponse,
)
def player_cache_status() -> PlayerCacheStatusResponse:
    """Reports whether the NFL player cache exists and is current."""

    return get_player_cache_status()


# Returns cached NFL player information.
@app.get(
    "/api/players",
    response_model=PlayerListResponse,
)
async def list_players(
    refresh: bool = Query(
        default=False,
        description=(
            "Force the server to refresh "
            "its Sleeper player cache."
        ),
    ),
) -> PlayerListResponse:
    """Returns fantasy-relevant NFL players from the server cache."""

    return await get_nfl_players(
        force_refresh=refresh,
    )
