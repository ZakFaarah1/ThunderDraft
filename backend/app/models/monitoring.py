from datetime import datetime

from pydantic import BaseModel


class PlayerCacheStatusResponse(BaseModel):
    """Describes the health and freshness of the NFL player cache."""

    status: str
    source: str
    playerCount: int
    cachedAt: datetime | None
    cacheExpiresAt: datetime | None
    cacheAgeSeconds: int | None
    stale: bool
    cacheFileExists: bool
