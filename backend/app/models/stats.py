from datetime import datetime

from pydantic import BaseModel


# Stores one player's statistics for one NFL season.
class PlayerSeasonStats(BaseModel):
    """Represents one player's regular-season statistics."""

    id: str
    gsisId: str
    name: str
    position: str
    nflTeam: str

    imageUrl: str | None = None
    fallbackImageUrl: str | None = None
    injuryStatus: str | None = None

    season: int
    games: int

    rank: int
    positionRank: int

    halfPprPoints: float
    pointsPerGame: float

    passingCompletions: int
    passingAttempts: int
    passingYards: int
    passingTouchdowns: int
    passingInterceptions: int

    carries: int
    rushingYards: int
    rushingTouchdowns: int

    targets: int
    receptions: int
    receivingYards: int
    receivingTouchdowns: int

    totalYards: int
    totalTouchdowns: int


# Provides simple four-year totals and averages for a player.
class PlayerHistorySummary(BaseModel):
    """Summarizes a player's available multi-season history."""

    seasonsPlayed: int
    totalGames: int
    totalHalfPprPoints: float
    averagePointsPerSeason: float
    averagePointsPerGame: float
    bestSeason: int | None
    bestSeasonPoints: float


# Returns the ranked players for one selected season.
class PlayerStatsListResponse(BaseModel):
    """Returns merged Sleeper and nflverse season statistics."""

    source: str
    selectedSeason: int
    availableSeasons: list[int]
    playerCount: int

    cachedAt: datetime
    cacheExpiresAt: datetime
    stale: bool

    players: list[PlayerSeasonStats]


# Returns a player's year-by-year statistics and summary.
class PlayerHistoryResponse(BaseModel):
    """Returns an easy-to-view multi-season player history."""

    id: str
    gsisId: str
    name: str
    position: str
    nflTeam: str

    imageUrl: str | None = None
    fallbackImageUrl: str | None = None
    injuryStatus: str | None = None

    availableSeasons: list[int]
    summary: PlayerHistorySummary
    seasons: list[PlayerSeasonStats]
