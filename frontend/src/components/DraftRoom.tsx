import { useState, type FormEvent } from "react";
import { fantasyTeams } from "../data/league";
import type { Position } from "../types";

interface ManualDraftPick {
  id: string;
  overallPick: number;
  fantasyTeamId: string;
  playerName: string;
  position: Position;
  nflTeam: string;
}

const positions: Position[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

function DraftRoom() {
  const [draftPicks, setDraftPicks] = useState<ManualDraftPick[]>(
    [],
  );

  const [fantasyTeamId, setFantasyTeamId] = useState(
    fantasyTeams[0].id,
  );

  const [playerName, setPlayerName] = useState("");
  const [position, setPosition] = useState<Position>("RB");
  const [nflTeam, setNflTeam] = useState("");

  const nextOverallPick = draftPicks.length + 1;

  function addDraftPick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPlayerName = playerName.trim();
    const trimmedNflTeam = nflTeam.trim().toUpperCase();

    if (!trimmedPlayerName) {
      return;
    }

    const newPick: ManualDraftPick = {
      id: `${Date.now()}-${nextOverallPick}`,
      overallPick: nextOverallPick,
      fantasyTeamId,
      playerName: trimmedPlayerName,
      position,
      nflTeam: trimmedNflTeam,
    };

    setDraftPicks((currentPicks) => [
      ...currentPicks,
      newPick,
    ]);

    setPlayerName("");
    setNflTeam("");
  }

  function undoLastPick() {
    setDraftPicks((currentPicks) =>
      currentPicks.slice(0, -1),
    );
  }

  return (
    <section className="draft-room">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live draft control</p>
          <h2>Draft Room</h2>
        </div>

        <div className="draft-room-actions">
          <span className="current-pick-badge">
            Pick {nextOverallPick}
          </span>

          <button
            className="secondary-button compact-button"
            disabled={draftPicks.length === 0}
            onClick={undoLastPick}
            type="button"
          >
            Undo Last Pick
          </button>
        </div>
      </div>

      <div className="draft-room-layout">
        <form className="pick-entry-card" onSubmit={addDraftPick}>
          <div>
            <p className="eyebrow">Record selection</p>
            <h3>Pick {nextOverallPick}</h3>
          </div>

          <label className="field-group">
            <span>League member</span>

            <select
              value={fantasyTeamId}
              onChange={(event) =>
                setFantasyTeamId(event.target.value)
              }
            >
              {fantasyTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.emoji} {team.name}
                  {team.isUser ? " — You" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Player name</span>

            <input
              onChange={(event) =>
                setPlayerName(event.target.value)
              }
              placeholder="Example: Justin Jefferson"
              required
              type="text"
              value={playerName}
            />
          </label>

          <div className="pick-form-row">
            <label className="field-group">
              <span>Position</span>

              <select
                value={position}
                onChange={(event) =>
                  setPosition(event.target.value as Position)
                }
              >
                {positions.map((playerPosition) => (
                  <option
                    key={playerPosition}
                    value={playerPosition}
                  >
                    {playerPosition}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>NFL team</span>

              <input
                maxLength={3}
                onChange={(event) =>
                  setNflTeam(event.target.value)
                }
                placeholder="MIN"
                type="text"
                value={nflTeam}
              />
            </label>
          </div>

          <button className="primary-button" type="submit">
            Add Pick
          </button>
        </form>

        <div className="draft-history-card">
          <div className="draft-history-heading">
            <div>
              <p className="eyebrow">Selections</p>
              <h3>Draft History</h3>
            </div>

            <span>{draftPicks.length} recorded</span>
          </div>

          {draftPicks.length === 0 ? (
            <div className="draft-empty-state">
              <strong>No picks recorded yet</strong>
              <span>
                Use the form to enter each league member’s
                selection.
              </span>
            </div>
          ) : (
            <div className="draft-pick-list">
              {[...draftPicks].reverse().map((pick) => {
                const fantasyTeam = fantasyTeams.find(
                  (team) => team.id === pick.fantasyTeamId,
                );

                return (
                  <article
                    className={`draft-pick ${
                      fantasyTeam?.isUser
                        ? "user-draft-pick"
                        : ""
                    }`}
                    key={pick.id}
                  >
                    <span className="draft-pick-number">
                      {pick.overallPick}
                    </span>

                    <div className="draft-pick-player">
                      <strong>{pick.playerName}</strong>

                      <span>
                        {pick.position}
                        {pick.nflTeam
                          ? ` · ${pick.nflTeam}`
                          : ""}
                      </span>
                    </div>

                    <div className="draft-pick-manager">
                      <span>{fantasyTeam?.emoji}</span>
                      <strong>
                        {fantasyTeam?.name ?? "Unknown"}
                      </strong>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default DraftRoom;