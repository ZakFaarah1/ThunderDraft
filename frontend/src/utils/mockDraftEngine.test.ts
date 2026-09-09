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
  createSeededRandom,
  rankCpuDraftCandidates,
  selectCpuDraftPlayer,
} from "./mockDraftEngine";

function player(
  id: string,
  position: Position,
  rank: number,
  adp = rank,
): Player {
  return {
    id,
    name: id,
    nflTeam: "TST",
    position,
    overallRank: rank,
    positionRank: rank,
    tier:
      rank <= 24
        ? 1
        : rank <= 60
          ? 2
          : 4,
    adp,
    projectedPoints: 150,
    byeWeek: 8,
    imageUrl: null,
  };
}

describe(
  "mock CPU draft realism",
  () => {
    it(
      "allows at most a three-pick overall reach",
      () => {
        const candidates =
          rankCpuDraftCandidates({
            availablePlayers: [
              player(
                "rank-24",
                "WR",
                24,
                24,
              ),
              player(
                "rank-27",
                "RB",
                27,
                27,
              ),
              player(
                "rank-28",
                "WR",
                28,
                28,
              ),
            ],
            roster: [],
            overallPick: 24,
            cpuStyle:
              "balanced",
            random: () => 0.5,
          });

        expect(
          candidates.some(
            (candidate) =>
              candidate.player.id ===
              "rank-27",
          ),
        ).toBe(true);

        expect(
          candidates.some(
            (candidate) =>
              candidate.player.id ===
              "rank-28",
          ),
        ).toBe(false);
      },
    );

    it(
      "allows at most a three-rank positional reach",
      () => {
        const bestAvailable =
          player(
            "wr-12",
            "WR",
            48,
            48,
          );

        bestAvailable.positionRank =
          12;

        const allowedReach =
          player(
            "wr-15",
            "WR",
            50,
            50,
          );

        allowedReach.positionRank =
          15;

        const excessiveReach =
          player(
            "wr-16",
            "WR",
            51,
            51,
          );

        excessiveReach.positionRank =
          16;

        const candidates =
          rankCpuDraftCandidates({
            availablePlayers: [
              bestAvailable,
              allowedReach,
              excessiveReach,
            ],
            roster: [],
            overallPick: 48,
            cpuStyle:
              "balanced",
            random: () => 0.5,
          });

        expect(
          candidates.some(
            (candidate) =>
              candidate.player.id ===
              "wr-15",
          ),
        ).toBe(true);

        expect(
          candidates.some(
            (candidate) =>
              candidate.player.id ===
              "wr-16",
          ),
        ).toBe(false);
      },
    );

    it(
      "strongly prefers useful depth over an early QB2",
      () => {
        const roster = [
          player(
            "starting-qb",
            "QB",
            40,
            40,
          ),
          player(
            "rb1",
            "RB",
            10,
            10,
          ),
          player(
            "wr1",
            "WR",
            20,
            20,
          ),
        ];

        const candidates =
          rankCpuDraftCandidates({
            availablePlayers: [
              player(
                "backup-qb",
                "QB",
                55,
                55,
              ),
              player(
                "needed-rb",
                "RB",
                58,
                58,
              ),
            ],
            roster,
            overallPick: 60,
            cpuStyle:
              "balanced",
            random: () => 0.5,
          });

        expect(
          candidates[0].player.id,
        ).toBe(
          "needed-rb",
        );
      },
    );

    it(
      "forces missing kicker and defense when only two roster spots remain",
      () => {
        const roster: Player[] = [
          player("qb", "QB", 20),
          player("rb1", "RB", 10),
          player("rb2", "RB", 20),
          player("rb3", "RB", 40),
          player("rb4", "RB", 60),
          player("rb5", "RB", 80),
          player("wr1", "WR", 12),
          player("wr2", "WR", 22),
          player("wr3", "WR", 42),
          player("wr4", "WR", 62),
          player("wr5", "WR", 82),
          player("te1", "TE", 35),
          player("te2", "TE", 90),
        ];

        const candidates =
          rankCpuDraftCandidates({
            availablePlayers: [
              player(
                "late-rb",
                "RB",
                150,
                150,
              ),
              player(
                "kicker",
                "K",
                160,
                160,
              ),
              player(
                "defense",
                "DST",
                165,
                165,
              ),
            ],
            roster,
            overallPick: 169,
            cpuStyle:
              "balanced",
            random: () => 0.5,
          });

        expect(
          candidates.every(
            (candidate) =>
              candidate.player
                .position === "K" ||
              candidate.player
                .position === "DST",
          ),
        ).toBe(true);
      },
    );

    it(
      "does not allow a second kicker",
      () => {
        const candidates =
          rankCpuDraftCandidates({
            availablePlayers: [
              player(
                "kicker-two",
                "K",
                150,
              ),
              player(
                "rb",
                "RB",
                145,
              ),
            ],
            roster: [
              player(
                "kicker-one",
                "K",
                140,
              ),
            ],
            overallPick: 150,
            cpuStyle:
              "balanced",
            random: () => 0.5,
          });

        expect(
          candidates.some(
            (candidate) =>
              candidate.player
                .position === "K",
          ),
        ).toBe(false);
      },
    );

    it(
      "produces repeatable seeded selections",
      () => {
        const availablePlayers = [
          player("one", "RB", 30),
          player("two", "WR", 31),
          player("three", "RB", 32),
          player("four", "WR", 33),
        ];

        const first =
          selectCpuDraftPlayer({
            availablePlayers,
            roster: [],
            overallPick: 30,
            cpuStyle:
              "balanced",
            random:
              createSeededRandom(
                12345,
              ),
          });

        const second =
          selectCpuDraftPlayer({
            availablePlayers,
            roster: [],
            overallPick: 30,
            cpuStyle:
              "balanced",
            random:
              createSeededRandom(
                12345,
              ),
          });

        expect(
          first?.id,
        ).toBe(
          second?.id,
        );
      },
    );
  },
);
