import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchDraftState,
} from "../api/client";

import {
  fantasyTeams,
} from "../data/league";

const draftOrderStorageKey =
  "thunderdraft-draft-order";

/**
 * Validates that an order contains every league member once.
 */
function isCompleteDraftOrder(
  teamIds: string[],
): boolean {
  const validTeamIds = new Set(
    fantasyTeams.map((team) => team.id),
  );

  return (
    teamIds.length === fantasyTeams.length &&
    new Set(teamIds).size === fantasyTeams.length &&
    teamIds.every((teamId) =>
      validTeamIds.has(teamId),
    )
  );
}

/**
 * Loads the browser fallback order if the API is unavailable.
 */
function loadBrowserDraftOrder(): string[] {
  try {
    const savedOrder = localStorage.getItem(
      draftOrderStorageKey,
    );

    if (!savedOrder) {
      return [];
    }

    const parsedOrder =
      JSON.parse(savedOrder);

    return Array.isArray(parsedOrder)
      ? parsedOrder.filter(
          (teamId): teamId is string =>
            typeof teamId === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * Displays league members and their saved draft positions.
 */
function LeaguePanel() {
  const [
    draftOrder,
    setDraftOrder,
  ] = useState<string[]>([]);

  const [
    orderLoading,
    setOrderLoading,
  ] = useState(true);

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadDraftOrder() {
      try {
        const state =
          await fetchDraftState(
            controller.signal,
          );

        if (controller.signal.aborted) {
          return;
        }

        setDraftOrder(
          isCompleteDraftOrder(
            state.draftOrder,
          )
            ? state.draftOrder
            : [],
        );
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        const browserOrder =
          loadBrowserDraftOrder();

        setDraftOrder(
          isCompleteDraftOrder(
            browserOrder,
          )
            ? browserOrder
            : [],
        );
      } finally {
        if (!controller.signal.aborted) {
          setOrderLoading(false);
        }
      }
    }

    void loadDraftOrder();

    return () => {
      controller.abort();
    };
  }, []);

  const hasDraftOrder =
    isCompleteDraftOrder(draftOrder);

  const draftSlotByTeamId =
    new Map(
      draftOrder.map(
        (teamId, index) => [
          teamId,
          index + 1,
        ],
      ),
    );

  const displayedTeams = useMemo(() => {
    const teamsWithSlots = fantasyTeams.map(
      (team) => ({
        ...team,
        draftSlot:
          draftSlotByTeamId.get(team.id) ?? null,
      }),
    );

    if (!hasDraftOrder) {
      return teamsWithSlots;
    }

    return [...teamsWithSlots].sort(
      (teamA, teamB) =>
        (teamA.draftSlot ?? 999) -
        (teamB.draftSlot ?? 999),
    );
  }, [draftSlotByTeamId, hasDraftOrder]);

  return (
    <section className="league-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            12-team half-PPR league
          </p>

          <h2>League Members</h2>
        </div>

        <span
          className={`order-pending ${
            hasDraftOrder
              ? "order-complete"
              : ""
          }`}
        >
          {orderLoading
            ? "Checking draft order"
            : hasDraftOrder
              ? "Draft order set"
              : "Draft order pending"}
        </span>
      </div>

      <div className="league-grid">
        {displayedTeams.map((team) => {
          const draftSlot = team.draftSlot;

          return (
            <article
              className={`league-team ${
                team.isUser ? "user-team" : ""
              }`}
              key={team.id}
            >
              <div
                className="team-emoji"
                aria-hidden="true"
              >
                {team.emoji}
              </div>

              <div className="team-details">
                <strong>
                  {draftSlot
                    ? `#${draftSlot} - ${team.name}`
                    : team.name}
                </strong>

                <span>
                  {draftSlot
                    ? team.isUser
                      ? "Your team"
                      : `Draft slot ${draftSlot}`
                    : team.isUser
                      ? "Your team · Slot not assigned"
                      : "Slot not assigned"}
                </span>
              </div>

              {team.isUser && (
                <span className="you-badge">
                  You
                </span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default LeaguePanel;
