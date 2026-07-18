import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  deleteDraftState,
  fetchDraftState,
  saveDraftState,
} from "./client";

import type {
  ApiDraftStatePayload,
  ApiDraftStateResponse,
} from "./types";


const draftStatePayload: ApiDraftStatePayload = {
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
        name: "Test Player",
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

const draftStateResponse: ApiDraftStateResponse = {
  ...draftStatePayload,
  updatedAt:
    "2026-07-18T21:24:28.730698+00:00",
};


/**
 * Creates one JSON response for mocked fetch requests.
 */
function createJsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      headers: {
        "Content-Type": "application/json",
      },
      status,
    },
  );
}


afterEach(() => {
  vi.unstubAllGlobals();
});


describe("draft-state API client", () => {
  it("loads the current SQLite draft state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        draftStateResponse,
      ),
    );

    vi.stubGlobal(
      "fetch",
      fetchMock,
    );

    await expect(
      fetchDraftState(),
    ).resolves.toEqual(
      draftStateResponse,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/draft/state",
      {
        signal: undefined,
      },
    );
  });

  it("saves a complete draft snapshot with PUT", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        draftStateResponse,
      ),
    );

    vi.stubGlobal(
      "fetch",
      fetchMock,
    );

    await expect(
      saveDraftState(
        draftStatePayload,
      ),
    ).resolves.toEqual(
      draftStateResponse,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/draft/state",
      {
        body: JSON.stringify(
          draftStatePayload,
        ),
        headers: {
          "Content-Type":
            "application/json",
        },
        method: "PUT",
        signal: undefined,
      },
    );
  });

  it("deletes the saved SQLite draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse({
        deleted: true,
      }),
    );

    vi.stubGlobal(
      "fetch",
      fetchMock,
    );

    await expect(
      deleteDraftState(),
    ).resolves.toEqual({
      deleted: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/draft/state",
      {
        method: "DELETE",
        signal: undefined,
      },
    );
  });

  it("surfaces backend validation errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createJsonResponse(
        {
          detail:
            "Draft contains duplicate pick identifiers.",
        },
        422,
      ),
    );

    vi.stubGlobal(
      "fetch",
      fetchMock,
    );

    await expect(
      saveDraftState(
        draftStatePayload,
      ),
    ).rejects.toThrow(
      "Draft contains duplicate pick identifiers.",
    );
  });
});
