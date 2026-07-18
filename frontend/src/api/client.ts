import type {
  ApiDraftPlayerListResponse,
  ApiDraftStateDeleteResponse,
  ApiDraftStatePayload,
  ApiDraftStateResponse,
  ApiPlayerHistoryResponse,
  ApiPlayerListResponse,
  ApiPlayerStatsListResponse,
} from "./types";

const apiBasePath = "/api";


/**
 * Extracts a useful error message from an unsuccessful API response.
 */
async function getApiErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?: string;
    };

    if (body.detail) {
      return body.detail;
    }
  } catch {
    // Falls back to the HTTP status when no JSON body is available.
  }

  return `API request failed with status ${response.status}.`;
}


/**
 * Sends a typed request to the ThunderDraft backend.
 */
async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    `${apiBasePath}${path}`,
    options,
  );

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(response),
    );
  }

  return (await response.json()) as T;
}


/**
 * Sends a typed GET request to the ThunderDraft backend.
 */
async function fetchJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  return requestJson<T>(
    path,
    {
      signal,
    },
  );
}


/**
 * Loads the complete current NFL player directory.
 */
export function fetchNflPlayers(
  signal?: AbortSignal,
): Promise<ApiPlayerListResponse> {
  return fetchJson<ApiPlayerListResponse>(
    "/players",
    signal,
  );
}


/**
 * Loads ranked half-PPR statistics for one season.
 */
export function fetchPlayerStats(
  season: number,
  signal?: AbortSignal,
): Promise<ApiPlayerStatsListResponse> {
  const query = new URLSearchParams({
    season: String(season),
  });

  return fetchJson<ApiPlayerStatsListResponse>(
    `/stats/players?${query.toString()}`,
    signal,
  );
}


/**
 * Loads all available seasons for one player.
 */
export function fetchPlayerHistory(
  gsisId: string,
  signal?: AbortSignal,
): Promise<ApiPlayerHistoryResponse> {
  const encodedPlayerId = encodeURIComponent(
    gsisId,
  );

  return fetchJson<ApiPlayerHistoryResponse>(
    `/stats/players/${encodedPlayerId}/history`,
    signal,
  );
}



/**
 * Loads the filtered upcoming-season fantasy draft pool.
 */
export function fetchDraftPlayers(
  signal?: AbortSignal,
): Promise<ApiDraftPlayerListResponse> {
  return fetchJson<ApiDraftPlayerListResponse>(
    "/draft/players",
    signal,
  );
}

/**
 * Loads the active draft snapshot from SQLite.
 */
export function fetchDraftState(
  signal?: AbortSignal,
): Promise<ApiDraftStateResponse> {
  return fetchJson<ApiDraftStateResponse>(
    "/draft/state",
    signal,
  );
}


/**
 * Creates or replaces the active SQLite draft snapshot.
 */
export function saveDraftState(
  state: ApiDraftStatePayload,
  signal?: AbortSignal,
): Promise<ApiDraftStateResponse> {
  return requestJson<ApiDraftStateResponse>(
    "/draft/state",
    {
      body: JSON.stringify(state),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
      signal,
    },
  );
}


/**
 * Deletes the active SQLite draft snapshot.
 */
export function deleteDraftState(
  signal?: AbortSignal,
): Promise<ApiDraftStateDeleteResponse> {
  return requestJson<ApiDraftStateDeleteResponse>(
    "/draft/state",
    {
      method: "DELETE",
      signal,
    },
  );
}
