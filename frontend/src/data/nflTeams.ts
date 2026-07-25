export interface NflTeamBrand {
  abbreviation: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
}

const espnLogoBase =
  "https://a.espncdn.com/i/teamlogos/nfl/500";

const nflTeamBrands: Record<
  string,
  Omit<NflTeamBrand, "logoUrl">
> = {
  ARI: {
    abbreviation: "ARI",
    name: "Arizona Cardinals",
    primaryColor: "#97233F",
    secondaryColor: "#FFB612",
  },
  ATL: {
    abbreviation: "ATL",
    name: "Atlanta Falcons",
    primaryColor: "#A71930",
    secondaryColor: "#A5ACAF",
  },
  BAL: {
    abbreviation: "BAL",
    name: "Baltimore Ravens",
    primaryColor: "#241773",
    secondaryColor: "#9E7C0C",
  },
  BUF: {
    abbreviation: "BUF",
    name: "Buffalo Bills",
    primaryColor: "#00338D",
    secondaryColor: "#C60C30",
  },
  CAR: {
    abbreviation: "CAR",
    name: "Carolina Panthers",
    primaryColor: "#0085CA",
    secondaryColor: "#BFC0BF",
  },
  CHI: {
    abbreviation: "CHI",
    name: "Chicago Bears",
    primaryColor: "#0B162A",
    secondaryColor: "#C83803",
  },
  CIN: {
    abbreviation: "CIN",
    name: "Cincinnati Bengals",
    primaryColor: "#FB4F14",
    secondaryColor: "#000000",
  },
  CLE: {
    abbreviation: "CLE",
    name: "Cleveland Browns",
    primaryColor: "#311D00",
    secondaryColor: "#FF3C00",
  },
  DAL: {
    abbreviation: "DAL",
    name: "Dallas Cowboys",
    primaryColor: "#003594",
    secondaryColor: "#869397",
  },
  DEN: {
    abbreviation: "DEN",
    name: "Denver Broncos",
    primaryColor: "#FB4F14",
    secondaryColor: "#002244",
  },
  DET: {
    abbreviation: "DET",
    name: "Detroit Lions",
    primaryColor: "#0076B6",
    secondaryColor: "#B0B7BC",
  },
  GB: {
    abbreviation: "GB",
    name: "Green Bay Packers",
    primaryColor: "#203731",
    secondaryColor: "#FFB612",
  },
  HOU: {
    abbreviation: "HOU",
    name: "Houston Texans",
    primaryColor: "#03202F",
    secondaryColor: "#A71930",
  },
  IND: {
    abbreviation: "IND",
    name: "Indianapolis Colts",
    primaryColor: "#002C5F",
    secondaryColor: "#A2AAAD",
  },
  JAX: {
    abbreviation: "JAX",
    name: "Jacksonville Jaguars",
    primaryColor: "#006778",
    secondaryColor: "#D7A22A",
  },
  KC: {
    abbreviation: "KC",
    name: "Kansas City Chiefs",
    primaryColor: "#E31837",
    secondaryColor: "#FFB81C",
  },
  LV: {
    abbreviation: "LV",
    name: "Las Vegas Raiders",
    primaryColor: "#000000",
    secondaryColor: "#A5ACAF",
  },
  LAC: {
    abbreviation: "LAC",
    name: "Los Angeles Chargers",
    primaryColor: "#0080C6",
    secondaryColor: "#FFC20E",
  },
  LAR: {
    abbreviation: "LAR",
    name: "Los Angeles Rams",
    primaryColor: "#003594",
    secondaryColor: "#FFA300",
  },
  MIA: {
    abbreviation: "MIA",
    name: "Miami Dolphins",
    primaryColor: "#008E97",
    secondaryColor: "#FC4C02",
  },
  MIN: {
    abbreviation: "MIN",
    name: "Minnesota Vikings",
    primaryColor: "#4F2683",
    secondaryColor: "#FFC62F",
  },
  NE: {
    abbreviation: "NE",
    name: "New England Patriots",
    primaryColor: "#002244",
    secondaryColor: "#C60C30",
  },
  NO: {
    abbreviation: "NO",
    name: "New Orleans Saints",
    primaryColor: "#D3BC8D",
    secondaryColor: "#101820",
  },
  NYG: {
    abbreviation: "NYG",
    name: "New York Giants",
    primaryColor: "#0B2265",
    secondaryColor: "#A71930",
  },
  NYJ: {
    abbreviation: "NYJ",
    name: "New York Jets",
    primaryColor: "#125740",
    secondaryColor: "#FFFFFF",
  },
  PHI: {
    abbreviation: "PHI",
    name: "Philadelphia Eagles",
    primaryColor: "#004C54",
    secondaryColor: "#A5ACAF",
  },
  PIT: {
    abbreviation: "PIT",
    name: "Pittsburgh Steelers",
    primaryColor: "#101820",
    secondaryColor: "#FFB612",
  },
  SEA: {
    abbreviation: "SEA",
    name: "Seattle Seahawks",
    primaryColor: "#002244",
    secondaryColor: "#69BE28",
  },
  SF: {
    abbreviation: "SF",
    name: "San Francisco 49ers",
    primaryColor: "#AA0000",
    secondaryColor: "#B3995D",
  },
  TB: {
    abbreviation: "TB",
    name: "Tampa Bay Buccaneers",
    primaryColor: "#D50A0A",
    secondaryColor: "#FF7900",
  },
  TEN: {
    abbreviation: "TEN",
    name: "Tennessee Titans",
    primaryColor: "#0C2340",
    secondaryColor: "#4B92DB",
  },
  WSH: {
    abbreviation: "WSH",
    name: "Washington Commanders",
    primaryColor: "#5A1414",
    secondaryColor: "#FFB612",
  },
};

const teamAliases: Record<string, string> = {
  JAC: "JAX",
  WAS: "WSH",
  OAK: "LV",
  SD: "LAC",
  STL: "LAR",
};

/**
 * Returns NFL logo and color information for one team.
 */
export function getNflTeamBrand(
  teamCode: string,
): NflTeamBrand | null {
  const normalizedCode =
    teamCode.trim().toUpperCase();

  const canonicalCode =
    teamAliases[normalizedCode] ??
    normalizedCode;

  const team =
    nflTeamBrands[canonicalCode];

  if (!team) {
    return null;
  }

  return {
    ...team,
    logoUrl:
      `${espnLogoBase}/${canonicalCode.toLowerCase()}.png`,
  };
}
