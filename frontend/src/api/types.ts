import type { Position } from "../types";

export type OffensivePosition =
  | "QB"
  | "RB"
  | "WR"
  | "TE";

export interface ApiNflPlayer {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  nflTeam: string;
  position: Position;
  fantasyPositions: string[];
  status: string | null;
  active: boolean;
  jerseyNumber: number | null;
  age: number | null;
  yearsExperience: number | null;
  injuryStatus: string | null;
  depthChartPosition: string | null;
  depthChartOrder: number | null;
  searchRank: number | null;
  espnId: string | null;
  gsisId: string | null;
  imageUrl: string | null;
  fallbackImageUrl: string | null;
}

export interface ApiPlayerListResponse {
  source: string;
  playerCount: number;
  cachedAt: string;
  cacheExpiresAt: string;
  stale: boolean;
  players: ApiNflPlayer[];
}

export interface ApiPlayerSeasonStats {
  id: string;
  gsisId: string;
  name: string;
  position: OffensivePosition;
  nflTeam: string;
  imageUrl: string | null;
  fallbackImageUrl: string | null;
  injuryStatus: string | null;

  season: number;
  games: number;

  rank: number;
  positionRank: number;

  halfPprPoints: number;
  pointsPerGame: number;

  passingCompletions: number;
  passingAttempts: number;
  passingYards: number;
  passingTouchdowns: number;
  passingInterceptions: number;

  carries: number;
  rushingYards: number;
  rushingTouchdowns: number;

  targets: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;

  totalYards: number;
  totalTouchdowns: number;
}

export interface ApiPlayerStatsListResponse {
  source: string;
  selectedSeason: number;
  availableSeasons: number[];
  playerCount: number;
  cachedAt: string;
  cacheExpiresAt: string;
  stale: boolean;
  players: ApiPlayerSeasonStats[];
}

export interface ApiPlayerHistorySummary {
  seasonsPlayed: number;
  totalGames: number;
  totalHalfPprPoints: number;
  averagePointsPerSeason: number;
  averagePointsPerGame: number;
  bestSeason: number | null;
  bestSeasonPoints: number;
}

export interface ApiPlayerHistoryResponse {
  id: string;
  gsisId: string;
  name: string;
  position: OffensivePosition;
  nflTeam: string;
  imageUrl: string | null;
  fallbackImageUrl: string | null;
  injuryStatus: string | null;
  availableSeasons: number[];
  summary: ApiPlayerHistorySummary;
  seasons: ApiPlayerSeasonStats[];
}
