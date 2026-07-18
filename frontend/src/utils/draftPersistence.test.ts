import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ApiDraftStatePayload,
  ApiDraftStateResponse,
} from "../api/types";

import {
  resolveInitialDraftState,
} from "./draftPersistence";


const localDraft: ApiDraftStatePayload = {
  draftOrder: [
    "abdi",
    "noor",
  ],
  picks: [
    {
      id: "pick-1",
      overallPick: 1,
      fantasyTeamId: "abdi",
      player: {
        id: "player-1",
        name: "Local Player",
        nflTeam: "MIN",
        position: "WR",
        overallRank: 1,
        positionRank: 1,
        tier: 1,
        adp: 1.2,
        projectedPoints: 250,
        byeWeek: 6,
        imageUrl: null,
      },
    },
  ],
};


describe("resolveInitialDraftState", () => {
  it("gives a saved server draft priority", () => {
    const serverState: ApiDraftStateResponse = {
      draftOrder: [
        "noor",
        "abdi",
      ],
      picks: [],
      updatedAt:
        "2026-07-18T21:24:28+00:00",
    };

    const resolution =
      resolveInitialDraftState(
        serverState,
        localDraft,
      );

    expect(resolution.source).toBe(
      "server",
    );

    expect(
      resolution.state.draftOrder,
    ).toEqual([
      "noor",
      "abdi",
    ]);

    expect(
      resolution.shouldMigrateLocal,
    ).toBe(false);
  });

  it("respects an intentional empty server reset", () => {
    const serverState: ApiDraftStateResponse = {
      draftOrder: [],
      picks: [],
      updatedAt:
        "2026-07-18T22:00:00+00:00",
    };

    const resolution =
      resolveInitialDraftState(
        serverState,
        localDraft,
      );

    expect(resolution.source).toBe(
      "server",
    );

    expect(resolution.state.picks).toEqual(
      [],
    );
  });

  it("migrates browser data when SQLite is pristine", () => {
    const serverState: ApiDraftStateResponse = {
      draftOrder: [],
      picks: [],
      updatedAt: null,
    };

    const resolution =
      resolveInitialDraftState(
        serverState,
        localDraft,
      );

    expect(resolution.source).toBe(
      "local",
    );

    expect(
      resolution.shouldMigrateLocal,
    ).toBe(true);

    expect(resolution.state).toEqual(
      localDraft,
    );
  });

  it("uses an empty state when neither source has data", () => {
    const serverState: ApiDraftStateResponse = {
      draftOrder: [],
      picks: [],
      updatedAt: null,
    };

    const resolution =
      resolveInitialDraftState(
        serverState,
        {
          draftOrder: [],
          picks: [],
        },
      );

    expect(resolution.source).toBe(
      "empty",
    );

    expect(resolution.state).toEqual({
      draftOrder: [],
      picks: [],
    });
  });
});
