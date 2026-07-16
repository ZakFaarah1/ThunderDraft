import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ApiDraftPlayer,
} from "./types";

import {
  mapApiDraftPlayers,
} from "./draftPlayers";


/**
 * Creates a complete API player with optional overrides.
 */
function createApiDraftPlayer(
  overrides: Partial<ApiDraftPlayer> = {},
): ApiDraftPlayer {
  return {
    id: "player-1",
    name: "Test Player",
    nflTeam: "MIN",
    position: "WR",

    active: true,
    status: "Active",
    injuryStatus: null,
    depthChartPosition: null,
    depthChartOrder: 1,
    yearsExperience: 2,

    isRookie: false,
    rookieRank: null,

    gsisId: null,
    espnId: null,
    imageUrl: null,
    fallbackImageUrl: null,

    draftSeason: 2026,
    byeWeek: null,

    marketRank: null,
    marketPositionRank: null,
    adp: null,
    adpFormatted: null,
    adpHigh: null,
    adpLow: null,
    adpStandardDeviation: null,
    timesDrafted: null,

    projectedPoints: null,
    projectionSource: null,
    projectionConfidence: null,

    thunderDraftRank: null,
    tier: null,

    ...overrides,
  };
}


/**
 * Verifies conversion from API records into draft-board players.
 */
describe("mapApiDraftPlayers", () => {
  /**
   * Places market-ranked players before estimated and unranked players.
   */
  it("uses rank sources in the expected order", () => {
    const players = mapApiDraftPlayers([
      createApiDraftPlayer({
        id: "unranked",
        name: "Unranked Veteran",
      }),
      createApiDraftPlayer({
        id: "rookie",
        name: "Rookie Player",
        isRookie: true,
        rookieRank: 3,
        yearsExperience: 0,
      }),
      createApiDraftPlayer({
        id: "market",
        name: "Market Player",
        marketRank: 7,
        adp: 7.4,
      }),
    ]);

    expect(
      players.map((player) => player.id),
    ).toEqual([
      "market",
      "rookie",
      "unranked",
    ]);

    expect(
      players[0].rankingSource,
    ).toBe("2026 market ADP");

    expect(
      players[1].rankingSource,
    ).toBe("2026 rookie estimate");
  });


  /**
   * Uses the fallback headshot and preserves rookie projections.
   */
  it("preserves rookie and image metadata", () => {
    const [player] = mapApiDraftPlayers([
      createApiDraftPlayer({
        isRookie: true,
        rookieRank: 1,
        yearsExperience: 0,
        projectedPoints: 180.5,
        projectionSource:
          "ThunderDraft rookie model v1",
        projectionConfidence: "High",
        fallbackImageUrl:
          "https://example.com/player.png",
      }),
    ]);

    expect(player.isRookie).toBe(true);
    expect(player.rookieRank).toBe(1);
    expect(
      player.projectedPoints,
    ).toBe(180.5);
    expect(player.imageUrl).toBe(
      "https://example.com/player.png",
    );
  });


  /**
   * Generates sequential positional ranks and usable tiers.
   */
  it("creates position ranks and tiers", () => {
    const players = mapApiDraftPlayers([
      createApiDraftPlayer({
        id: "wr-2",
        name: "Second Receiver",
        marketRank: 20,
      }),
      createApiDraftPlayer({
        id: "wr-1",
        name: "First Receiver",
        marketRank: 10,
      }),
    ]);

    expect(
      players.map(
        (player) => player.positionRank,
      ),
    ).toEqual([
      1,
      2,
    ]);

    expect(players[0].tier).toBe(1);
    expect(players[1].tier).toBe(1);
  });
});
