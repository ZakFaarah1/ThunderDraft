import { useEffect, useState } from "react";
import "./App.css";

type ApiStatus = "checking" | "healthy" | "offline";

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const apiUrl = `http://${window.location.hostname}:8001/api/health`;

    fetch(apiUrl)
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
          <p className="eyebrow">Fantasy football draft intelligence</p>

          <h2>
            Build your rankings.
            <br />
            Control your draft.
          </h2>

          <p className="hero-description">
            Import player data, customize your strategy, track drafted players,
            and always see the best option available.
          </p>

          <div className="button-row">
            <button className="primary-button">Enter Draft Room</button>
            <button className="secondary-button">Import Rankings</button>
          </div>
        </div>

        <div className="preview-card">
          <p className="eyebrow">Coming next</p>
          <h3>Draft Board</h3>

          <div className="player-row">
            <span className="rank">01</span>
            <strong>Overall rankings</strong>
            <span className="position">ALL</span>
          </div>

          <div className="player-row">
            <span className="rank">02</span>
            <strong>Position filters</strong>
            <span className="position">RB</span>
          </div>

          <div className="player-row">
            <span className="rank">03</span>
            <strong>Strategy adjustments</strong>
            <span className="position">WR</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;