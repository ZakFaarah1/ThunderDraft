import type {
  FantasyTeam,
  LeagueSettings,
  RosterSettings,
} from "../types";

export const defaultLeagueSettings: LeagueSettings = {
  teamCount: 12,
  scoringFormat: "half-ppr",
  draftFormat: "snake",
  draftSlot: null,
};

export const defaultRosterSettings: RosterSettings = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DST: 1,
  BENCH: 6,
};

/*
 * These are the league members only.
 * This array does not represent the official draft order.
 * Draft slots will be assigned later.
 */
export const fantasyTeams: FantasyTeam[] = [
  {
    id: "abdi",
    name: "Abdi",
    emoji: "🎯",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "noor",
    name: "Noor",
    emoji: "✨",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "sicko",
    name: "Sicko",
    emoji: "🤪",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "ish",
    name: "Ish",
    emoji: "👑",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "hamza",
    name: "Hamza",
    emoji: "🦁",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "moman",
    name: "Moman",
    emoji: "🛡️",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "magoo",
    name: "Magoo",
    emoji: "👓",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "shaq",
    name: "Shaq",
    emoji: "🏀",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "buck",
    name: "Buck",
    emoji: "🦌",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "thunder",
    name: "Thunder",
    emoji: "⚡",
    isUser: true,
    draftSlot: null,
  },
  {
    id: "obeid",
    name: "Obeid",
    emoji: "🔥",
    isUser: false,
    draftSlot: null,
  },
  {
    id: "majeed",
    name: "Majeed",
    emoji: "🌟",
    isUser: false,
    draftSlot: null,
  },
];