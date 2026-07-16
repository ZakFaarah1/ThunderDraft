export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export type ScoringFormat = "standard" | "half-ppr" | "ppr";

export type DraftFormat = "snake" | "linear";

export type ProjectionConfidence =
  | "High"
  | "Medium"
  | "Low";

export type RankingSource =
  | "ThunderDraft 2026"
  | "2026 market ADP"
  | "2026 rookie estimate"
  | "Unranked pool";

export interface LeagueSettings {
  teamCount: number;
  scoringFormat: ScoringFormat;
  draftFormat: DraftFormat;
  draftSlot: number | null;
}

export interface RosterSettings {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  K: number;
  DST: number;
  BENCH: number;
}

export interface Player {
  id: string;
  name: string;
  nflTeam: string;
  position: Position;
  overallRank: number;
  positionRank: number;
  tier: number;
  adp: number | null;
  projectedPoints: number | null;
  byeWeek: number | null;
  imageUrl: string | null;

  gsisId?: string | null;
  yearsExperience?: number | null;
  injuryStatus?: string | null;
  depthChartPosition?: string | null;
  depthChartOrder?: number | null;

  isRookie?: boolean;
  rookieRank?: number | null;
  projectionSource?: string | null;
  projectionConfidence?: ProjectionConfidence | null;

  draftSeason?: number;
  rankingSource?: RankingSource;
}

export interface DraftPick {
  id: string;
  overallPick: number;
  round: number;
  pickInRound: number;
  fantasyTeam: number;
  playerId: string;
  isUserPick: boolean;
}

export interface Recommendation {
  playerId: string;
  score: number;
  reasons: string[];
}

export interface FantasyTeam {
  id: string;
  name: string;
  emoji: string;
  isUser: boolean;
  draftSlot: number | null;
}