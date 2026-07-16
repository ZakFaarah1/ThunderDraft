import { useMemo, useState } from "react";
import { fantasyTeams } from "../data/league";

interface DraftOrderSetupProps {
  initialOrder?: string[];
  onSave: (teamIds: string[]) => void;
}

function DraftOrderSetup({
  initialOrder = [],
  onSave,
}: DraftOrderSetupProps) {
  const [draftOrder, setDraftOrder] = useState<string[]>(
    initialOrder.length === fantasyTeams.length
      ? initialOrder
      : Array(fantasyTeams.length).fill(""),
  );

  const selectedTeamIds = useMemo(
    () => new Set(draftOrder.filter(Boolean)),
    [draftOrder],
  );

  const isComplete =
    draftOrder.every(Boolean) &&
    selectedTeamIds.size === fantasyTeams.length;

  function updateDraftSlot(
    slotIndex: number,
    fantasyTeamId: string,
  ) {
    setDraftOrder((currentOrder) => {
      const updatedOrder = [...currentOrder];
      updatedOrder[slotIndex] = fantasyTeamId;
      return updatedOrder;
    });
  }

  function saveDraftOrder() {
    if (!isComplete) {
      return;
    }

    onSave(draftOrder);
  }

  return (
    <section className="draft-order-setup">
      <div className="section-heading">
        <div>
          <p className="eyebrow">League configuration</p>
          <h2>Set Draft Order</h2>
        </div>

        <span className="order-pending">
          {isComplete ? "Order complete" : "Order pending"}
        </span>
      </div>

      <p className="draft-order-description">
        Assign each league member to their official draft
        position. ThunderDraft will use this order to manage
        every round of the snake draft automatically.
      </p>

      <div className="draft-order-grid">
        {draftOrder.map((fantasyTeamId, slotIndex) => {
          const selectedTeam = fantasyTeams.find(
            (team) => team.id === fantasyTeamId,
          );

          return (
            <label
              className={`draft-slot-card ${
                selectedTeam?.isUser
                  ? "user-draft-slot"
                  : ""
              }`}
              key={slotIndex}
            >
              <span className="draft-slot-number">
                {slotIndex + 1}
              </span>

              <div className="draft-slot-control">
                <span>
                  Pick {slotIndex + 1}
                  {selectedTeam?.isUser
                    ? " · Your position"
                    : ""}
                </span>

                <select
                  onChange={(event) =>
                    updateDraftSlot(
                      slotIndex,
                      event.target.value,
                    )
                  }
                  value={fantasyTeamId}
                >
                  <option value="">
                    Select league member
                  </option>

                  {fantasyTeams.map((team) => {
                    const selectedInAnotherSlot =
                      selectedTeamIds.has(team.id) &&
                      team.id !== fantasyTeamId;

                    return (
                      <option
                        disabled={selectedInAnotherSlot}
                        key={team.id}
                        value={team.id}
                      >
                        {team.emoji} {team.name}
                        {team.isUser ? " — You" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </label>
          );
        })}
      </div>

      <div className="draft-order-footer">
        <span>
          {
            draftOrder.filter(Boolean).length
          } of {fantasyTeams.length} positions assigned
        </span>

        <button
          className="primary-button"
          disabled={!isComplete}
          onClick={saveDraftOrder}
          type="button"
        >
          Save Draft Order
        </button>
      </div>
    </section>
  );
}

export default DraftOrderSetup;