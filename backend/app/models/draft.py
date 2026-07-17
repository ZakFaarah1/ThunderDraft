from datetime import datetime

from pydantic import BaseModel


# Represents one current player in the upcoming draft pool.
class DraftPlayer(BaseModel):
    """Combines current player data, ADP, and projections."""

    id: str
    name: str
    nflTeam: str
    position: str

    active: bool
    status: str | None = None
    injuryStatus: str | None = None
    depthChartPosition: str | None = None
    depthChartOrder: int | None = None
    yearsExperience: int | None = None

    isRookie: bool
    rookieRank: int | None = None

    gsisId: str | None = None
    espnId: str | None = None
    imageUrl: str | None = None
    fallbackImageUrl: str | None = None

    draftSeason: int
    byeWeek: int | None = None

    marketRank: int | None = None
    marketPositionRank: int | None = None
    adp: float | None = None
    adpFormatted: str | None = None
    adpHigh: int | None = None
    adpLow: int | None = None
    adpStandardDeviation: float | None = None
    timesDrafted: int | None = None

    projectedPoints: float | None = None
    projectionSource: str | None = None
    projectionConfidence: str | None = None

    thunderDraftRank: int | None = None
    tier: int | None = None


# Returns the complete pool and data-coverage information.
class DraftPlayerListResponse(BaseModel):
    """Returns current draft candidates with optional market data."""

    source: str
    draftSeason: int
    scoringFormat: str
    teamCount: int

    playerCount: int
    candidatePlayerCount: int
    rookieCount: int
    projectedRookieCount: int
    excludedCandidateCount: int

    freeAgentCount: int
    withoutAdpCount: int
    withoutProjectionCount: int
    excludedNonFantasyPositionCount: int

    adpSourcePlayerCount: int
    matchedAdpPlayerCount: int
    unmatchedAdpCount: int
    unmatchedAdpPlayers: list[str]

    cachedAt: datetime
    cacheExpiresAt: datetime
    stale: bool

    players: list[DraftPlayer]
