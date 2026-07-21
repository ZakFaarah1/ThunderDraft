import {
  useEffect,
  useState,
} from "react";
import DraftRoom from "./components/DraftRoom";
import LeaguePanel from "./components/LeaguePanel";
import StatsPage from "./components/StatsPage";
import "./App.css";

type ApiStatus =
  | "checking"
  | "healthy"
  | "offline";

type AppPage =
  | "home"
  | "draft"
  | "stats";


/**
 * Displays the ThunderDraft homepage, draft room, and stats page.
 */
function App() {
  const [apiStatus, setApiStatus] =
    useState<ApiStatus>("checking");

  const [currentPage, setCurrentPage] =
    useState<AppPage>("home");

  const [
    openDraftOrderOnEntry,
    setOpenDraftOrderOnEntry,
  ] = useState(false);

  /*
   * Checks whether the ThunderDraft backend is available.
   */
  useEffect(() => {
    fetch("/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "API request failed",
          );
        }

        return response.json();
      })
      .then(() => {
        setApiStatus("healthy");
      })
      .catch(() => {
        setApiStatus("offline");
      });
  }, []);

  const statusText = {
    checking: "Checking API",
    healthy: "API Online",
    offline: "API Offline",
  }[apiStatus];

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand brand-button"
          onClick={() =>
            setCurrentPage("home")
          }
          type="button"
        >
          <div className="brand-icon">
            ⚡
          </div>

          <div>
            <p className="eyebrow">
              ThunderHub Sports Lab
            </p>

            <h1>ThunderDraft</h1>
          </div>
        </button>

        <div className="topbar-actions">
          {currentPage === "draft" && (
            <button
              className="secondary-button compact-button"
              onClick={() =>
                setCurrentPage("stats")
              }
              type="button"
            >
              Player Stats
            </button>
          )}

          {currentPage === "stats" && (
            <button
              className="secondary-button compact-button"
              onClick={() =>
                setCurrentPage("draft")
              }
              type="button"
            >
              Draft Room
            </button>
          )}

          {currentPage !== "home" && (
            <button
              className="secondary-button compact-button"
              onClick={() =>
                setCurrentPage("home")
              }
              type="button"
            >
              Back to Home
            </button>
          )}

          <div
            className={
              `status-pill status-${apiStatus}`
            }
          >
            <span className="status-dot" />
            {statusText}
          </div>
        </div>
      </header>

      {currentPage === "home" && (
        <>
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
                Track every selection, react to
                positional runs, and build the strongest
                possible half-PPR roster regardless of
                what the other eleven teams decide.
              </p>

              <div className="button-row">
                <button
                  className="primary-button"
                  onClick={() =>
                    setCurrentPage("draft")
                  }
                  type="button"
                >
                  Enter Draft Room
                </button>

                <button
                  className="secondary-button"
                  onClick={() =>
                    setCurrentPage("stats")
                  }
                  type="button"
                >
                  View Player Stats
                </button>
              </div>
            </div>

            <div className="preview-card">
              <p className="eyebrow">
                Draft assistant status
              </p>

              <h3>Neutral Strategy Mode</h3>

              <div className="player-row">
                <span className="rank">
                  01
                </span>

                <strong>
                  12-team league
                </strong>

                <span className="position">
                  12
                </span>
              </div>

              <div className="player-row">
                <span className="rank">
                  02
                </span>

                <strong>
                  Half-PPR scoring
                </strong>

                <span className="position">
                  0.5
                </span>
              </div>

              <button
                className="player-row draft-position-action"
                onClick={() => {
                  setOpenDraftOrderOnEntry(
                    true,
                  );

                  setCurrentPage("draft");
                }}
                type="button"
              >
                <span className="rank">
                  03
                </span>

                <strong>
                  Draft position
                </strong>

                <span className="position">
                  Set order
                </span>
              </button>
            </div>
          </section>

          <LeaguePanel />
        </>
      )}

      {currentPage === "draft" && (
        <div className="draft-page">
          <DraftRoom
            onDraftOrderEntryHandled={() =>
              setOpenDraftOrderOnEntry(false)
            }
            openDraftOrderOnEntry={
              openDraftOrderOnEntry
            }
          />
        </div>
      )}

      {currentPage === "stats" && (
        <StatsPage />
      )}
    </main>
  );
}

export default App;
