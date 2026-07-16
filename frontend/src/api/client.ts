import type {
  ApiDraftPlayerListResponse,
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
async function fetchJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(
    `${apiBasePath}${path}`,
    {
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(
      await getApiErrorMessage(response),
    );
  }

  return (await response.json()) as T;
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
