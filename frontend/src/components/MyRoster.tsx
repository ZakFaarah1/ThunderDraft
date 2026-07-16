import type { Player } from "../types";
import { buildRosterAssignments } from "../utils/roster";

interface MyRosterProps {
  players: Player[];
}

function MyRoster({ players }: MyRosterProps) {
  const rosterAssignments = buildRosterAssignments(players);

  const starterAssignments = rosterAssignments.filter(
    (assignment) => assignment.isStarter,
  );

  const benchAssignments = rosterAssignments.filter(
    (assignment) => !assignment.isStarter,
  );

  const filledStarterCount = starterAssignments.filter(
    (assignment) => assignment.player !== null,
  ).length;

  return (
    <section className="my-roster-card">
      <div className="my-roster-heading">
        <div>
          <p className="eyebrow">Thunder ⚡</p>
          <h3>My Roster</h3>
        </div>

        <span className="roster-count">
          {players.length} drafted
        </span>
      </div>

      <div className="roster-progress">
        <div>
          <span>Starting lineup</span>

          <strong>
            {filledStarterCount}/{starterAssignments.length}
          </strong>
        </div>

        <div className="roster-progress-track">
          <span
            style={{
              width: `${
                (filledStarterCount /
                  starterAssignments.length) *
                100
              }%`,
            }}
          />
        </div>
      </div>

      <div className="roster-section">
        <div className="roster-section-heading">
          <span>Starters</span>
          <strong>{filledStarterCount} filled</strong>
        </div>

        <div className="roster-slot-list">
          {starterAssignments.map((assignment) => (
            <article
              className={`roster-slot ${
                assignment.player
                  ? "filled-roster-slot"
                  : "empty-roster-slot"
              }`}
              key={assignment.slot}
            >
              <span className="roster-slot-name">
                {assignment.slot}
              </span>

              {assignment.player ? (
                <>
                  <div className="roster-player-headshot">
                    {assignment.player.imageUrl ? (
                      <img
                        alt={`${assignment.player.name} headshot`}
                        src={assignment.player.imageUrl}
                      />
                    ) : (
                      <span aria-hidden="true">
                        {assignment.player.name
                          .split(" ")
                          .map((namePart) => namePart[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div className="roster-player-details">
                    <strong>
                      {assignment.player.name}
                    </strong>

                    <span>
                      {assignment.player.position} ·{" "}
                      {assignment.player.nflTeam}
                    </span>
                  </div>

                  <span className="roster-player-projection">
                    {assignment.player.projectedPoints?.toFixed(
                      1,
                    ) ?? "—"}
                  </span>
                </>
              ) : (
                <div className="empty-roster-message">
                  <strong>Empty</strong>
                  <span>Position still needed</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="roster-section">
        <div className="roster-section-heading">
          <span>Bench</span>

          <strong>
            {
              benchAssignments.filter(
                (assignment) =>
                  assignment.player !== null,
              ).length
            } filled
          </strong>
        </div>

        <div className="roster-slot-list">
          {benchAssignments.map((assignment) => (
            <article
              className={`roster-slot ${
                assignment.player
                  ? "filled-roster-slot"
                  : "empty-roster-slot"
              }`}
              key={assignment.slot}
            >
              <span className="roster-slot-name">
                {assignment.slot}
              </span>

              {assignment.player ? (
                <>
                  <div className="roster-player-headshot">
                    {assignment.player.imageUrl ? (
                      <img
                        alt={`${assignment.player.name} headshot`}
                        src={assignment.player.imageUrl}
                      />
                    ) : (
                      <span aria-hidden="true">
                        {assignment.player.name
                          .split(" ")
                          .map((namePart) => namePart[0])
                          .join("")
                          .slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div className="roster-player-details">
                    <strong>
                      {assignment.player.name}
                    </strong>

                    <span>
                      {assignment.player.position} ·{" "}
                      {assignment.player.nflTeam}
                    </span>
                  </div>

                  <span className="roster-player-projection">
                    {assignment.player.projectedPoints?.toFixed(
                      1,
                    ) ?? "—"}
                  </span>
                </>
              ) : (
                <div className="empty-roster-message">
                  <strong>Empty</strong>
                  <span>Available bench slot</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default MyRoster;