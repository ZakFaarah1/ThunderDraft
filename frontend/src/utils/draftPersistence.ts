import type {
  ApiDraftStatePayload,
  ApiDraftStateResponse,
} from "../api/types";


export type DraftStateSource =
  | "server"
  | "local"
  | "empty";


export interface DraftStateResolution {
  state: ApiDraftStatePayload;
  source: DraftStateSource;
  shouldMigrateLocal: boolean;
}


/**
 * Reports whether SQLite contains an intentional saved state.
 */
export function hasPersistedDraftState(
  state: ApiDraftStateResponse,
): boolean {
  return (
    state.updatedAt !== null ||
    state.draftOrder.length > 0 ||
    state.picks.length > 0
  );
}


/**
 * Gives SQLite priority and migrates browser data only when
 * the server has never stored a draft.
 */
export function resolveInitialDraftState(
  serverState: ApiDraftStateResponse,
  localState: ApiDraftStatePayload,
): DraftStateResolution {
  if (hasPersistedDraftState(serverState)) {
    return {
      state: {
        draftOrder: serverState.draftOrder,
        picks: serverState.picks,
      },
      source: "server",
      shouldMigrateLocal: false,
    };
  }

  if (
    localState.draftOrder.length > 0 ||
    localState.picks.length > 0
  ) {
    return {
      state: localState,
      source: "local",
      shouldMigrateLocal: true,
    };
  }

  return {
    state: {
      draftOrder: [],
      picks: [],
    },
    source: "empty",
    shouldMigrateLocal: false,
  };
}


/**
 * Creates a stable comparison value for complete snapshots.
 */
export function serializeDraftState(
  state: ApiDraftStatePayload,
): string {
  return JSON.stringify(state);
}
