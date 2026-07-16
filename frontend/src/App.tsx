import { useEffect, useState } from "react";
import LeaguePanel from "./components/LeaguePanel";
import "./App.css";

type ApiStatus = "checking" | "healthy" | "offline";

function App() {
  const [apiStatus, setApiStatus] =
    useState<ApiStatus>("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("API request failed");
        }

        return response.json();
      })
      .then(() => setApiStatus("healthy"))
      .catch(() => setApiStatus("offline"));
  }, []);

  const statusText = {
    checking: "Checking API",
    healthy: "API Online",
    offline: "API Offline",
  }[apiStatus];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">⚡</div>

          <div>
            <p className="eyebrow">ThunderHub Sports Lab</p>
            <h1>ThunderDraft</h1>
          </div>
        </div>

        <div className={`status-pill status-${apiStatus}`}>
          <span className="status-dot" />
          {statusText}
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            Fantasy football draft intelligence
          </p>

          <h2>
            Build your rankings.
            <br />
            Control your draft.
          </h2>

          <p className="hero-description">
            Track every selection, react to positional runs,
            and build the strongest possible half-PPR roster
            regardless of what the other eleven teams decide.
          </p>

          <div className="button-row">
            <button className="primary-button">
              Enter Draft Room
            </button>

            <button className="secondary-button">
              Import Rankings
            </button>
          </div>
        </div>

        <div className="preview-card">
          <p className="eyebrow">Draft assistant status</p>
          <h3>Neutral Strategy Mode</h3>

          <div className="player-row">
            <span className="rank">01</span>
            <strong>12-team league</strong>
            <span className="position">12</span>
          </div>

          <div className="player-row">
            <span className="rank">02</span>
            <strong>Half-PPR scoring</strong>
            <span className="position">0.5</span>
          </div>

          <div className="player-row">
            <span className="rank">03</span>
            <strong>Draft position</strong>
            <span className="position">TBD</span>
          </div>
        </div>
      </section>

      <LeaguePanel />
    </main>
  );
}

export default App;