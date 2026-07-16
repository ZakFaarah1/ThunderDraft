import type { Player, Position } from "../types";

export interface RosterAssignment {
  slot: string;
  player: Player | null;
  isStarter: boolean;
}

interface StarterSlot {
  name: string;
  acceptedPositions: Position[];
}

const starterSlots: StarterSlot[] = [
  {
    name: "QB",
    acceptedPositions: ["QB"],
  },
  {
    name: "RB1",
    acceptedPositions: ["RB"],
  },
  {
    name: "RB2",
    acceptedPositions: ["RB"],
  },
  {
    name: "WR1",
    acceptedPositions: ["WR"],
  },
  {
    name: "WR2",
    acceptedPositions: ["WR"],
  },
  {
    name: "TE",
    acceptedPositions: ["TE"],
  },
  {
    name: "FLEX",
    acceptedPositions: ["RB", "WR", "TE"],
  },
  {
    name: "K",
    acceptedPositions: ["K"],
  },
  {
    name: "DST",
    acceptedPositions: ["DST"],
  },
];

export function buildRosterAssignments(
  draftedPlayers: Player[],
  benchSize = 6,
): RosterAssignment[] {
  const remainingPlayers = [...draftedPlayers];

  const starterAssignments = starterSlots.map(
    (starterSlot): RosterAssignment => {
      const playerIndex = remainingPlayers.findIndex(
        (player) =>
          starterSlot.acceptedPositions.includes(
            player.position,
          ),
      );

      if (playerIndex === -1) {
        return {
          slot: starterSlot.name,
          player: null,
          isStarter: true,
        };
      }

      const [player] = remainingPlayers.splice(
        playerIndex,
        1,
      );

      return {
        slot: starterSlot.name,
        player,
        isStarter: true,
      };
    },
  );

  const benchAssignments = Array.from(
    { length: benchSize },
    (_, benchIndex): RosterAssignment => ({
      slot: `BN${benchIndex + 1}`,
      player: remainingPlayers[benchIndex] ?? null,
      isStarter: false,
    }),
  );

  return [
    ...starterAssignments,
    ...benchAssignments,
  ];
}