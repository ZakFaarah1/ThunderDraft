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
    overallRank: 50,
    positionRank: 10,
    tier: 3,
    adp: 50,
    projectedPoints: 150,
    byeWeek: 8,
    imageUrl: null,
    ...overrides,
  };
}

/**
 * Creates several test players at the same position.
 */
function createPositionGroup(
  position: Position,
  count: number,
  startingIndex = 1,
): Player[] {
  return Array.from(
    {
      length: count,
    },
    (_, index) =>
      createPlayer(
        `${position}-${startingIndex + index}`,
        position,
        {
          positionRank: startingIndex + index,
        },
      ),
  );
}

/**
 * Verifies roster-health scoring and weakness detection.
 */
describe("getRosterHealthReport", () => {
  /**
   * Confirms that an empty roster has major RB and WR needs.
   */
  it("identifies an empty roster as weak", () => {
    const report =
      getRosterHealthReport([]);

    expect(report.score).toBe(4);
    expect(report.level).toBe("weak");

    expect(
      report.issues.map(
        (issue) => issue.id,
      ),
    ).toEqual([
      "missing-RB-starters",
      "missing-WR-starters",
    ]);

    expect(
      report.weakestPositions,
    ).toEqual([
      "RB",
      "WR",
    ]);
  });

  /**
   * Confirms that a balanced and complete roster is healthy.
   */
  it("scores a complete balanced roster as strong", () => {
    const completeRoster = [
      ...createPositionGroup("QB", 1),
      ...createPositionGroup("RB", 4),
      ...createPositionGroup("WR", 4),
      ...createPositionGroup("TE", 2),
      ...createPositionGroup("K", 1),
      ...createPositionGroup("DST", 1),
    ];

    const report =
      getRosterHealthReport(
        completeRoster,
      );

    expect(report.score).toBe(100);
    expect(report.level).toBe("strong");
    expect(report.issues).toEqual([]);
    expect(
      report.weakestPositions,
    ).toEqual([]);

    expect(report.strengths).toContain(
      "Strong RB depth",
    );

    expect(report.strengths).toContain(
      "Strong WR depth",
    );

    expect(report.strengths).toContain(
      "QB and TE starters secured",
    );

    expect(report.strengths).toContain(
      "Strong FLEX competition",
    );
  });

  /**
   * Confirms that drafting a second quarterback early is flagged.
   */
  it("detects an early backup quarterback", () => {
    const earlyRoster = [
      ...createPositionGroup("QB", 2),
      ...createPositionGroup("RB", 2),
      ...createPositionGroup("WR", 2),
    ];

    const report =
      getRosterHealthReport(
        earlyRoster,
      );

    expect(
      report.issues.some(
        (issue) =>
          issue.id ===
          "early-backup-qb",
      ),
    ).toBe(true);

    expect(report.score).toBe(58);
    expect(report.level).toBe("weak");
  });

  /**
   * Confirms that an early kicker or defense is flagged.
   */
  it("detects an early kicker selection", () => {
    const earlyRoster = [
      ...createPositionGroup("RB", 2),
      ...createPositionGroup("WR", 1),
      ...createPositionGroup("K", 1),
    ];

    const report =
      getRosterHealthReport(
        earlyRoster,
      );

    expect(
      report.issues.some(
        (issue) =>
          issue.id ===
          "early-kicker-defense",
      ),
    ).toBe(true);

    expect(report.score).toBe(60);
    expect(report.level).toBe("watch");
  });

  /**
   * Confirms that missing late-round starters become urgent.
   */
  it("flags missing QB, kicker, and defense late in the draft", () => {
    const lateRoster = [
      ...createPositionGroup("RB", 5),
      ...createPositionGroup("WR", 6),
      ...createPositionGroup("TE", 1),
    ];

    const report =
      getRosterHealthReport(
        lateRoster,
      );

    expect(
      report.issues.map(
        (issue) => issue.id,
      ),
    ).toEqual([
      "missing-QB-starter",
      "missing-K-starter",
      "missing-DST-starter",
    ]);

    expect(report.score).toBe(58);
    expect(report.level).toBe("weak");

    expect(
      report.weakestPositions,
    ).toEqual([
      "QB",
      "K",
      "DST",
    ]);
  });

  /**
   * Confirms that thin skill-position and FLEX depth are detected.
   */
  it("detects thin RB, WR, and FLEX depth", () => {
    const thinRoster = [
      ...createPositionGroup("QB", 2),
      ...createPositionGroup("RB", 2),
      ...createPositionGroup("WR", 2),
      ...createPositionGroup("TE", 2),
      ...createPositionGroup("K", 1),
      ...createPositionGroup("DST", 1),
    ];

    const report =
      getRosterHealthReport(
        thinRoster,
      );

    const issueIds =
      report.issues.map(
        (issue) => issue.id,
      );

    expect(issueIds).toContain(
      "thin-RB-depth",
    );

    expect(issueIds).toContain(
      "thin-WR-depth",
    );

    expect(issueIds).toContain(
      "thin-flex-depth",
    );

    expect(report.score).toBe(54);
    expect(report.level).toBe("weak");

    expect(
      report.weakestPositions,
    ).toEqual([
      "RB",
      "WR",
    ]);

    expect(
      report.weakestPositions,
    ).not.toContain("FLEX");
  });
});