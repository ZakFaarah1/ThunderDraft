import { fantasyTeams } from "../data/league";

function LeaguePanel() {
  return (
    <section className="league-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">12-team half-PPR league</p>
          <h2>League Members</h2>
        </div>

        <span className="order-pending">Draft order pending</span>
      </div>

      <div className="league-grid">
        {fantasyTeams.map((team) => (
          <article
            className={`league-team ${team.isUser ? "user-team" : ""}`}
            key={team.id}
          >
            <div className="team-emoji" aria-hidden="true">
              {team.emoji}
            </div>

            <div className="team-details">
              <strong>{team.name}</strong>

              <span>
                {team.isUser
                  ? "Your team"
                  : team.draftSlot
                    ? `Draft slot ${team.draftSlot}`
                    : "Slot not assigned"}
              </span>
            </div>

            {team.isUser && <span className="you-badge">You</span>}
          </article>
        ))}
      </div>
    </section>
  );
}

export default LeaguePanel;