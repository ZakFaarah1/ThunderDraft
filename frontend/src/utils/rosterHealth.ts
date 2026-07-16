import type {
  Player,
  Position,
} from "../types";

export type RosterHealthLevel =
  | "strong"
  | "watch"
  | "weak";

export type RosterHealthPosition =
  | Position
  | "FLEX";

export interface RosterHealthIssue {
  id: string;
  position: RosterHealthPosition;
  level: Exclude<
    RosterHealthLevel,
    "strong"
  >;
  title: string;
  description: string;
  priority: number;
}

export interface RosterHealthReport {
  score: number;
  level: RosterHealthLevel;
  issues: RosterHealthIssue[];
  strengths: string[];
  positionCounts: Record<
    Position,
    number
  >;
  weakestPositions: Position[];
}

interface PositionNeed {
  position: Position;
  target: number;
  priority: number;
}

/*
 * Defines the minimum starting lineup requirements.
 */
const starterTargets: Record<
  Position,
  number
> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
};

/*
 * Defines the preferred roster-depth targets.
 */
const depthTargets: Record<
  Position,
  number
> = {
  QB: 1,
  RB: 4,
  WR: 4,
  TE: 2,
  K: 1,
  DST: 1,
};

/**
 * Keeps a numeric value within the supplied range.
 */
function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

/**
 * Counts the drafted players at every position.
 */
function countPlayersByPosition(
  players: Player[],
): Record<Position, number> {
  const positionCounts: Record<
    Position,
    number
  > = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DST: 0,
  };

  players.forEach((player) => {
    positionCounts[player.position] += 1;
  });

  return positionCounts;
}

/**
 * Adds an issue only when another issue with the same ID
 * has not already been recorded.
 */
function addUniqueIssue(
  issues: RosterHealthIssue[],
  issue: RosterHealthIssue,
): void {
  const issueAlreadyExists =
    issues.some(
      (existingIssue) =>
        existingIssue.id === issue.id,
    );

  if (!issueAlreadyExists) {
    issues.push(issue);
  }
}

/**
 * Evaluates missing RB and WR starting positions.
 */
function addSkillStarterIssues(
  positionCounts: Record<
    Position,
    number
  >,
  issues: RosterHealthIssue[],
): void {
  const skillStarterNeeds:
    PositionNeed[] = [
      {
        position: "RB",
        target: starterTargets.RB,
        priority: 24,
      },
      {
        position: "WR",
        target: starterTargets.WR,
        priority: 24,
      },
    ];

  skillStarterNeeds.forEach(
    ({
      position,
      target,
      priority,
    }) => {
      const missingStarters =
        target -
        positionCounts[position];

      if (missingStarters <= 0) {
        return;
      }

      addUniqueIssue(issues, {
        id: `missing-${position}-starters`,
        position,
        level: "weak",
        title: `Open ${position} starter ${
          missingStarters > 1
            ? "spots"
            : "spot"
        }`,
        description:
          `Your roster still needs ${missingStarters} starting ${position}${
            missingStarters > 1
              ? "s"
              : ""
          }.`,
        priority:
          priority * missingStarters,
      });
    },
  );
}

/**
 * Evaluates quarterback and tight-end starter timing.
 */
function addCoreStarterIssues(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  const corePositions: Position[] = [
    "QB",
    "TE",
  ];

  corePositions.forEach((position) => {
    if (
      positionCounts[position] >=
      starterTargets[position]
    ) {
      return;
    }

    /*
     * Missing QB or TE is not urgent during the
     * opening rounds.
     */
    if (draftedPlayerCount < 5) {
      return;
    }

    const isLateDraft =
      draftedPlayerCount >= 9;

    addUniqueIssue(issues, {
      id: `missing-${position}-starter`,
      position,
      level: isLateDraft
        ? "weak"
        : "watch",
      title: `No starting ${position}`,
      description: isLateDraft
        ? `The draft is getting late and your ${position} starter is still open.`
        : `Begin watching the remaining ${position} tiers before value disappears.`,
      priority: isLateDraft
        ? 22
        : 10,
    });
  });
}

/**
 * Evaluates kicker and defense only during the late draft.
 */
function addLateStarterIssues(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  if (draftedPlayerCount < 10) {
    return;
  }

  const latePositions: Position[] = [
    "K",
    "DST",
  ];

  latePositions.forEach((position) => {
    if (
      positionCounts[position] >=
      starterTargets[position]
    ) {
      return;
    }

    const isVeryLateDraft =
      draftedPlayerCount >= 12;

    addUniqueIssue(issues, {
      id: `missing-${position}-starter`,
      position,
      level: isVeryLateDraft
        ? "weak"
        : "watch",
      title: `No starting ${position}`,
      description: isVeryLateDraft
        ? `Secure a ${position} before the final rounds are complete.`
        : `${position} can wait, but it should remain on the late-round checklist.`,
      priority: isVeryLateDraft
        ? 10
        : 4,
    });
  });
}

/**
 * Evaluates RB and WR depth after the early rounds.
 */
function addSkillDepthIssues(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  if (draftedPlayerCount < 6) {
    return;
  }

  const desiredDepth =
    draftedPlayerCount >= 10
      ? 4
      : 3;

  const depthPositions: Position[] = [
    "RB",
    "WR",
  ];

  depthPositions.forEach((position) => {
    const missingDepth =
      desiredDepth -
      positionCounts[position];

    if (missingDepth <= 0) {
      return;
    }

    addUniqueIssue(issues, {
      id: `thin-${position}-depth`,
      position,
      level:
        draftedPlayerCount >= 10
          ? "weak"
          : "watch",
      title: `Thin ${position} depth`,
      description:
        `Your roster has ${positionCounts[position]} ${position}${
          positionCounts[position] === 1
            ? ""
            : "s"
        }; the current depth target is ${desiredDepth}.`,
      priority:
        draftedPlayerCount >= 10
          ? 16
          : 9,
    });
  });
}

/**
 * Evaluates the combined depth available for the FLEX spot.
 */
function addFlexDepthIssue(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  if (draftedPlayerCount < 7) {
    return;
  }

  const flexPlayerCount =
    positionCounts.RB +
    positionCounts.WR +
    positionCounts.TE;

  const flexDepthTarget =
    draftedPlayerCount >= 10
      ? 8
      : 6;

  if (
    flexPlayerCount >=
    flexDepthTarget
  ) {
    return;
  }

  addUniqueIssue(issues, {
    id: "thin-flex-depth",
    position: "FLEX",
    level:
      draftedPlayerCount >= 10
        ? "weak"
        : "watch",
    title: "Limited FLEX depth",
    description:
      `You have ${flexPlayerCount} combined RB, WR, and TE options; the current target is ${flexDepthTarget}.`,
    priority:
      draftedPlayerCount >= 10
        ? 14
        : 7,
  });
}

/**
 * Detects early overinvestment at low-priority positions.
 */
function addOverinvestmentIssues(
  positionCounts: Record<
    Position,
    number
  >,
  draftedPlayerCount: number,
  issues: RosterHealthIssue[],
): void {
  if (
    positionCounts.QB > 1 &&
    draftedPlayerCount < 10
  ) {
    addUniqueIssue(issues, {
      id: "early-backup-qb",
      position: "QB",
      level: "watch",
      title: "Early backup quarterback",
      description:
        "A second quarterback may have reduced your RB or WR depth.",
      priority: 14,
    });
  }

  if (
    positionCounts.TE > 2 &&
    draftedPlayerCount < 11
  ) {
    addUniqueIssue(issues, {
      id: "excess-tight-ends",
      position: "TE",
      level: "watch",
      title: "Heavy tight-end investment",
      description:
        "More than two tight ends can create weaknesses at RB or WR.",
      priority: 12,
    });
  }

  if (
    draftedPlayerCount < 10 &&
    positionCounts.K +
      positionCounts.DST >
      0
  ) {
    addUniqueIssue(issues, {
      id: "early-kicker-defense",
      position:
        positionCounts.K > 0
          ? "K"
          : "DST",
      level: "watch",
      title:
        "Early kicker or defense selection",
      description:
        "Kicker and defense are usually better addressed after core depth is secured.",
      priority: 16,
    });
  }

  if (positionCounts.QB > 2) {
    addUniqueIssue(issues, {
      id: "too-many-quarterbacks",
      position: "QB",
      level: "weak",
      title: "Too many quarterbacks",
      description:
        "Three quarterbacks consume roster space that is usually more valuable at RB or WR.",
      priority: 22,
    });
  }
}

/**
 * Identifies roster strengths that should be preserved.
 */
function getRosterStrengths(
  positionCounts: Record<
    Position,
    number
  >,
): string[] {
  const strengths: string[] = [];

  if (
    positionCounts.RB >=
    starterTargets.RB
  ) {
    strengths.push(
      "Starting RB spots covered",
    );
  }

  if (
    positionCounts.WR >=
    starterTargets.WR
  ) {
    strengths.push(
      "Starting WR spots covered",
    );
  }

  if (
    positionCounts.RB >=
    depthTargets.RB
  ) {
    strengths.push(
      "Strong RB depth",
    );
  }

  if (
    positionCounts.WR >=
    depthTargets.WR
  ) {
    strengths.push(
      "Strong WR depth",
    );
  }

  if (
    positionCounts.QB >= 1 &&
    positionCounts.TE >= 1
  ) {
    strengths.push(
      "QB and TE starters secured",
    );
  }

  const flexPlayerCount =
    positionCounts.RB +
    positionCounts.WR +
    positionCounts.TE;

  if (flexPlayerCount >= 8) {
    strengths.push(
      "Strong FLEX competition",
    );
  }

  return strengths;
}

/**
 * Determines the overall roster-health label.
 */
function getRosterHealthLevel(
  score: number,
): RosterHealthLevel {
  if (score >= 80) {
    return "strong";
  }

  if (score >= 60) {
    return "watch";
  }

  return "weak";
}

/**
 * Returns the positions connected to the most urgent issues.
 */
function getWeakestPositions(
  issues: RosterHealthIssue[],
): Position[] {
  const positionPriorities =
    new Map<Position, number>();

  issues.forEach((issue) => {
    if (issue.position === "FLEX") {
      return;
    }

    const currentPriority =
      positionPriorities.get(
        issue.position,
      ) ?? 0;

    positionPriorities.set(
      issue.position,
      currentPriority +
        issue.priority,
    );
  });

  return Array.from(
    positionPriorities.entries(),
  )
    .sort(
      (
        firstPosition,
        secondPosition,
      ) =>
        secondPosition[1] -
        firstPosition[1],
    )
    .map(
      ([position]) => position,
    );
}

/**
 * Creates a complete health report for the user's roster.
 */
export function getRosterHealthReport(
  draftedPlayers: Player[],
): RosterHealthReport {
  const positionCounts =
    countPlayersByPosition(
      draftedPlayers,
    );

  const issues: RosterHealthIssue[] =
    [];

  addSkillStarterIssues(
    positionCounts,
    issues,
  );

  addCoreStarterIssues(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  addLateStarterIssues(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  addSkillDepthIssues(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  addFlexDepthIssue(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  addOverinvestmentIssues(
    positionCounts,
    draftedPlayers.length,
    issues,
  );

  const sortedIssues = issues.sort(
    (firstIssue, secondIssue) =>
      secondIssue.priority -
      firstIssue.priority,
  );

  const totalPenalty =
    sortedIssues.reduce(
      (penalty, issue) =>
        penalty + issue.priority,
      0,
    );

  const score = clamp(
    100 - totalPenalty,
    0,
    100,
  );

  return {
    score,
    level:
      getRosterHealthLevel(score),
    issues: sortedIssues,
    strengths:
      getRosterStrengths(
        positionCounts,
      ),
    positionCounts,
    weakestPositions:
      getWeakestPositions(
        sortedIssues,
      ),
  };
}