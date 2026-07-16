from datetime import datetime

from pydantic import BaseModel


class NflPlayer(BaseModel):
    """Represents one normalized fantasy-relevant NFL player."""

    id: str
    name: str
    firstName: str | None = None
    lastName: str | None = None
    nflTeam: str
    position: str
    fantasyPositions: list[str]
    status: str | None = None
    active: bool
    jerseyNumber: int | None = None
    age: int | None = None
    yearsExperience: int | None = None
    injuryStatus: str | None = None
    depthChartPosition: str | None = None
    depthChartOrder: int | None = None
    searchRank: int | None = None
    espnId: str | None = None
    gsisId: str | None = None
    imageUrl: str | None = None
    fallbackImageUrl: str | None = None


class PlayerListResponse(BaseModel):
    """Returns normalized players and server-cache information."""

    source: str
    playerCount: int
    cachedAt: datetime
    cacheExpiresAt: datetime
    stale: bool
    players: list[NflPlayer]
