import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Player,
  Position,
} from "../types";

import {
  getRosterHealthReport,
} from "./rosterHealth";

/**
 * Creates a complete test player with optional overrides.
 */
function createPlayer(
  id: string,
  position: Position,
  overrides: Partial<Player> = {},
): Player {
  return {
    id,
    name: `Test ${position} ${id}`,
    nflTeam: "TST",
    position,
    overallRank: 90,
    positionRank: 20,
    tier: 4,
    adp: 90,
    projectedPoints: 150,
    byeWeek: 8,
    imageUrl: null,
    ...overrides,
  };
}

/**
 * Creates position players with gradually declining value.
 */
function createPositionGroup(
  position: Position,
  count: number,
  startingAdp: number,
  startingPositionRank = 1,
): Player[] {
  return Array.from(
    {
      length: count,
    },
    (_, index) => {
      const adp =
        startingAdp + index * 12;

      return createPlayer(
        `${position}-${index + 1}`,
        position,
        {
          adp,
          overallRank: Math.round(adp),
          positionRank:
            startingPositionRank + index,
          tier: Math.max(
            1,
            Math.ceil(adp / 30),
          ),
        },
      );
    },
  );
}

/**
 * Creates a realistic 15-player roster.
 */
function createBalancedRoster(): Player[] {
  return [
    ...createPositionGroup(
      "QB",
      1,
      58,
      7,
    ),
    ...createPositionGroup(
      "RB",
      5,
      8,
      3,
    ),
    ...createPositionGroup(
      "WR",
      5,
      20,
      8,
    ),
    ...createPositionGroup(
      "TE",
      2,
      70,
      8,
    ),
    createPlayer(
      "K-1",
      "K",
      {
        adp: 168,
        overallRank: 168,
        positionRank: 15,
        tier: 8,
      },
    ),
    createPlayer(
      "DST-1",
      "DST",
      {
        adp: 160,
        overallRank: 160,
        positionRank: 12,
        tier: 8,
      },
    ),
  ];
}

/**
 * Creates the same legal starters for bench comparisons.
 */
function createFixedStarters(): Player[] {
  return [
    createPlayer(
      "QB-starter",
      "QB",
      {
        adp: 35,
        overallRank: 35,
        positionRank: 4,
        tier: 2,
      },
    ),
    createPlayer(
      "RB-starter-1",
      "RB",
      {
        adp: 5,
        overallRank: 5,
        positionRank: 1,
        tier: 1,
      },
    ),
    createPlayer(
      "RB-starter-2",
      "RB",
      {
        adp: 20,
        overallRank: 20,
        positionRank: 8,
        tier: 2,
      },
    ),
    createPlayer(
      "WR-starter-1",
      "WR",
      {
        adp: 7,
        overallRank: 7,
        positionRank: 2,
        tier: 1,
      },
    ),
    createPlayer(
      "WR-starter-2",
      "WR",
      {
        adp: 24,
        overallRank: 24,
        positionRank: 10,
        tier: 2,
      },
    ),
    createPlayer(
      "TE-starter",
      "TE",
      {
        adp: 45,
        overallRank: 45,
        positionRank: 5,
        tier: 2,
      },
    ),
    createPlayer(
      "FLEX-starter",
      "WR",
      {
        adp: 35,
        overallRank: 35,
        positionRank: 15,
        tier: 2,
      },
    ),
    createPlayer(
      "K-starter",
      "K",
      {
        adp: 130,
        overallRank: 130,
        positionRank: 1,
        tier: 6,
      },
    ),
    createPlayer(
      "DST-starter",
      "DST",
      {
        adp: 135,
        overallRank: 135,
        positionRank: 1,
        tier: 6,
      },
    ),
  ];
}

/**
 * Verifies absolute roster power, bench value, and needs.
 */
describe("getRosterHealthReport", () => {
  /**
   * Confirms that an empty roster has no roster power.
   */
  it("starts an empty roster at zero", () => {
    const report =
      getRosterHealthReport([]);

    expect(report.score).toBe(0);
    expect(report.starterGrade).toBe(0);
    expect(report.benchGrade).toBe(0);
    expect(
      report.constructionGrade,
    ).toBe(0);
    expect(report.benchCount).toBe(0);
    expect(report.level).toBe("weak");

    expect(
      report.issues.map(
        (issue) => issue.id,
      ),
    ).toEqual([
      "missing-RB-starters",
      "missing-WR-starters",
    ]);
  });

  /**
   * Confirms that a normal completed roster is not perfect.
   */
  it("scores a balanced roster realistically below 100", () => {
    const report =
      getRosterHealthReport(
        createBalancedRoster(),
      );

    expect(report.score).toBeGreaterThanOrEqual(
      65,
    );
    expect(report.score).toBeLessThan(90);
    expect(report.score).toBeLessThan(100);
    expect(report.starterGrade).toBeGreaterThan(0);
    expect(report.benchGrade).toBeGreaterThan(0);
    expect(report.constructionGrade).toBe(100);
    expect(report.benchCount).toBe(6);
    expect(report.startingLineup).toHaveLength(9);
    expect(report.benchAssets).toHaveLength(6);
  });

  /**
   * Confirms that the strongest possible roster still cannot reach 100.
   */
  it("keeps a theoretical superteam below 100", () => {
    const superteam = [
      ...createPositionGroup(
        "QB",
        1,
        4,
        1,
      ),
      ...createPositionGroup(
        "RB",
        5,
        1,
        1,
      ),
      ...createPositionGroup(
        "WR",
        5,
        2,
        1,
      ),
      ...createPositionGroup(
        "TE",
        2,
        6,
        1,
      ),
      createPlayer(
        "elite-K",
        "K",
        {
          adp: 121,
          overallRank: 121,
          positionRank: 1,
          tier: 1,
        },
      ),
      createPlayer(
        "elite-DST",
        "DST",
        {
          adp: 122,
          overallRank: 122,
          positionRank: 1,
          tier: 1,
        },
      ),
    ];

    const report =
      getRosterHealthReport(superteam);

    expect(report.score).toBeGreaterThan(90);
    expect(report.score).toBeLessThanOrEqual(99);
    expect(report.score).not.toBe(100);
  });

  /**
   * Confirms that bench assets meaningfully change roster power.
   */
  it("rewards a strong bench over a weak bench", () => {
    const starters =
      createFixedStarters();

    const strongBench = [
      ...createPositionGroup(
        "RB",
        3,
        40,
        10,
      ),
      ...createPositionGroup(
        "WR",
        3,
        45,
        12,
      ),
    ];

    const weakBench = [
      ...createPositionGroup(
        "RB",
        3,
        150,
        45,
      ),
      ...createPositionGroup(
        "WR",
        3,
        165,
        55,
      ),
    ];

    const strongReport =
      getRosterHealthReport([
        ...starters,
        ...strongBench,
      ]);

    const weakReport =
      getRosterHealthReport([
        ...starters,
        ...weakBench,
      ]);

    expect(
      strongReport.benchGrade,
    ).toBeGreaterThan(
      weakReport.benchGrade,
    );

    expect(strongReport.score).toBeGreaterThan(
      weakReport.score,
    );

    expect(
      strongReport.starterGrade,
    ).toBeGreaterThanOrEqual(
      weakReport.starterGrade,
    );
  });

  /**
   * Confirms that bench slot value declines after the top reserves.
   */
  it("weights the best bench assets more heavily", () => {
    const roster = [
      ...createFixedStarters(),
      ...createPositionGroup(
        "RB",
        3,
        48,
        12,
      ),
      ...createPositionGroup(
        "WR",
        3,
        70,
        22,
      ),
    ];

    const report =
      getRosterHealthReport(roster);

    expect(
      report.benchAssets[0]
        .benchWeight,
    ).toBeGreaterThan(
      report.benchAssets[5]
        .benchWeight,
    );

    expect(
      report.benchAssets[0].grade,
    ).toBeGreaterThanOrEqual(
      report.benchAssets[5].grade,
    );
  });

  /**
   * Confirms that duplicate K and DST depth has little value.
   */
  it("discounts extra kicker and defense bench assets", () => {
    const roster = [
      ...createFixedStarters(),
      createPlayer(
        "backup-K",
        "K",
        {
          adp: 140,
          overallRank: 140,
          positionRank: 2,
        },
      ),
      createPlayer(
        "backup-DST",
        "DST",
        {
          adp: 142,
          overallRank: 142,
          positionRank: 2,
        },
      ),
    ];

    const report =
      getRosterHealthReport(roster);

    const specialTeamsAssets =
      report.benchAssets.filter(
        (asset) =>
          asset.position === "K" ||
          asset.position === "DST",
      );

    expect(
      specialTeamsAssets.every(
        (asset) =>
          asset.grade <
          asset.baseGrade,
      ),
    ).toBe(true);
  });

  /**
   * Confirms that full starter coverage can still be weak.
   */
  it("flags below-market RB starters despite full coverage", () => {
    const report =
      getRosterHealthReport([
        createPlayer(
          "weak-RB-1",
          "RB",
          {
            positionRank: 42,
            adp: 125,
          },
        ),
        createPlayer(
          "weak-RB-2",
          "RB",
          {
            positionRank: 55,
            adp: 165,
          },
        ),
        ...createPositionGroup(
          "WR",
          2,
          30,
          8,
        ),
      ]);

    expect(report.positionCounts.RB).toBe(2);
    expect(
      report.issues.map(
        (issue) => issue.id,
      ),
    ).toContain(
      "weak-RB-starter-quality",
    );
    expect(report.weakestPositions[0]).toBe(
      "RB",
    );
  });

  /**
   * Confirms that elite starters outscore weak starters.
   */
  it("scores elite RB starters above weak RB starters", () => {
    const eliteReport =
      getRosterHealthReport([
        createPlayer(
          "elite-RB-1",
          "RB",
          {
            positionRank: 1,
            adp: 4,
          },
        ),
        createPlayer(
          "elite-RB-2",
          "RB",
          {
            positionRank: 3,
            adp: 14,
          },
        ),
        ...createPositionGroup(
          "WR",
          2,
          30,
          8,
        ),
      ]);

    const weakReport =
      getRosterHealthReport([
        createPlayer(
          "weak-RB-1",
          "RB",
          {
            positionRank: 42,
            adp: 125,
          },
        ),
        createPlayer(
          "weak-RB-2",
          "RB",
          {
            positionRank: 55,
            adp: 165,
          },
        ),
        ...createPositionGroup(
          "WR",
          2,
          30,
          8,
        ),
      ]);

    expect(
      eliteReport.positionScores.RB,
    ).toBeGreaterThan(
      weakReport.positionScores.RB,
    );

    expect(
      eliteReport.starterGrade,
    ).toBeGreaterThan(
      weakReport.starterGrade,
    );
  });

  /**
   * Confirms that missing ADP receives a confidence reduction.
   */
  it("uses position rank conservatively when ADP is missing", () => {
    const tightEnd =
      createPlayer(
        "missing-adp-TE",
        "TE",
        {
          positionRank: 24,
          adp: null,
          overallRank: 190,
          tier: 7,
        },
      );

    const report =
      getRosterHealthReport([
        ...createBalancedRoster().filter(
          (player) =>
            player.position !== "TE",
        ),
        tightEnd,
      ]);

    expect(
      report.positionHealth.TE
        .averageStarterAdp,
    ).toBeNull();

    expect(
      report.positionHealth.TE
        .averageStarterPositionRank,
    ).toBe(24);

    expect(
      report.issues.map(
        (issue) => issue.id,
      ),
    ).toContain(
      "weak-TE-starter-quality",
    );
  });

  /**
   * Confirms that missing late-round starters remain urgent.
   */
  it("flags missing QB, K, and DST late in the draft", () => {
    const lateRoster = [
      ...createPositionGroup(
        "RB",
        5,
        20,
        5,
      ),
      ...createPositionGroup(
        "WR",
        6,
        25,
        6,
      ),
      ...createPositionGroup(
        "TE",
        1,
        70,
        8,
      ),
    ];

    const report =
      getRosterHealthReport(lateRoster);

    expect(
      report.issues.map(
        (issue) => issue.id,
      ),
    ).toEqual([
      "missing-QB-starter",
      "missing-K-starter",
      "missing-DST-starter",
    ]);

    expect(report.weakestPositions).toEqual([
      "QB",
      "K",
      "DST",
    ]);
  });

  /**
   * Confirms that early duplicate quarterbacks hurt construction.
   */
  it("penalizes early quarterback overinvestment", () => {
    const balanced = [
      ...createPositionGroup(
        "QB",
        1,
        45,
        5,
      ),
      ...createPositionGroup(
        "RB",
        3,
        20,
        5,
      ),
      ...createPositionGroup(
        "WR",
        3,
        25,
        6,
      ),
    ];

    const overinvested = [
      ...balanced,
      createPlayer(
        "QB-extra-1",
        "QB",
        {
          adp: 75,
          positionRank: 10,
        },
      ),
      createPlayer(
        "QB-extra-2",
        "QB",
        {
          adp: 100,
          positionRank: 16,
        },
      ),
    ];

    const balancedReport =
      getRosterHealthReport(balanced);

    const overinvestedReport =
      getRosterHealthReport(
        overinvested,
      );

    expect(
      overinvestedReport.issues.map(
        (issue) => issue.id,
      ),
    ).toContain(
      "too-many-quarterbacks",
    );

    expect(
      overinvestedReport.constructionGrade,
    ).toBeLessThanOrEqual(
      balancedReport.constructionGrade,
    );
  });

  /**
   * Confirms that K and DST remain part of positional health.
   */
  it("grades kicker and defense as real roster positions", () => {
    const report =
      getRosterHealthReport(
        createBalancedRoster(),
      );

    expect(report.positionScores.K).toBeGreaterThan(
      0,
    );
    expect(report.positionScores.DST).toBeGreaterThan(
      0,
    );

    expect(
      report.startingLineup.some(
        (assignment) =>
          assignment.slot === "K" &&
          assignment.playerId !== null,
      ),
    ).toBe(true);

    expect(
      report.startingLineup.some(
        (assignment) =>
          assignment.slot === "DST" &&
          assignment.playerId !== null,
      ),
    ).toBe(true);
  });
});
