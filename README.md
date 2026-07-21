# ThunderDraft

ThunderDraft is a self-hosted fantasy football draft assistant designed for live 12-team, half-PPR snake drafts.

It combines live draft tracking, player rankings, market ADP, historical statistics, roster analysis, persistent draft storage, and explainable recommendations in one responsive interface.

## Overview

ThunderDraft helps manage an entire fantasy football draft from one dashboard.

The application tracks every selection, automatically determines which team is on the clock, removes drafted players from the available pool, evaluates roster construction, and recommends players based on value, team needs, positional scarcity, tiers, recent draft trends, and the number of picks until the user's next turn.

Draft progress is saved continuously to SQLite and can be restored after refreshing the browser, opening the app on another device, restarting Docker containers, or rebooting the host server.

## Main Features

### Live Draft Room

- 12-team snake draft support
- 15-player roster limit per team
- Automatic snake-order calculations
- Live pick tracking
- Current team on the clock
- Recent draft history
- Undo last pick
- Reset draft picks
- Completed draft state
- Team-by-team draft results
- Automatic removal of drafted players
- Draft-order locking after the first pick

### Draft Order Management

- Manual draft-order setup
- Random automatic draft-order generation
- Clear and edit draft-order controls
- Saved draft order displayed on the homepage
- League members sorted by draft position
- Direct homepage shortcut to draft-order setup
- Green status indicator when the order is complete
- Persistent draft-order storage

### Player Pool

The draft pool includes active players at:

- QB
- RB
- WR
- TE
- K
- DST

Player records may include:

- Player name
- NFL team
- Position
- Overall rank
- Positional rank
- Market ADP
- ADP range
- Tier
- Bye week
- Injury status
- Depth-chart position
- Depth-chart order
- Years of experience
- Rookie status
- Player headshot
- Historical fantasy performance

Players are not removed from the draft pool solely because ADP or projection data is unavailable.

### Draft Recommendations

ThunderDraft evaluates available players using several factors:

- Overall rank
- Position rank
- Market ADP
- Player tier
- Projected fantasy points
- Roster needs
- Positional scarcity
- Recent positional runs
- Picks until the user's next turn
- Starting-lineup needs
- Bench construction
- Excess players at certain positions

Recommendations include readable explanations instead of only showing a score.

### Roster Analysis

- Automatic best-lineup assignment
- Starter evaluation
- Bench evaluation
- Roster construction score
- Overall roster power score
- Position-balance checks
- Roster health warnings
- Full-roster enforcement
- Reduced value for excessive QB, TE, K, and DST selections

### Historical Statistics

- Multi-season player history
- Half-PPR fantasy points
- Points per game
- Games played
- Passing statistics
- Rushing statistics
- Receiving statistics
- Total yards
- Total touchdowns
- Career summaries
- Player search
- Position filters
- Detailed player modal

### Persistent Draft Storage

ThunderDraft continuously saves the active draft to SQLite.

The following information is stored:

- Draft order
- Drafted players
- Overall pick numbers
- Fantasy team assignments
- Full player snapshots
- Last updated timestamp

The application also maintains a browser `localStorage` copy as a fallback if the backend becomes temporarily unavailable.

SQLite data remains available after:

- Browser refreshes
- Opening the app in a different browser
- Opening the app on another device
- Docker container restarts
- Docker container recreation
- Host server reboots

## Technology Stack

### Frontend

**React**

React is used to build the interactive user interface. It manages the homepage, draft room, player board, roster display, recommendations, draft-order editor, results modal, and statistics pages.

**TypeScript**

TypeScript provides static typing across the frontend. It helps keep player records, draft picks, API responses, league data, and recommendation logic consistent.

**Vite**

Vite is used as the frontend development server and production build tool. It provides fast local development and generates the optimized production files served by Nginx.

**Vitest**

Vitest is used for frontend unit testing. Tests cover draft calculations, roster limits, recommendation logic, player mapping, persistence behavior, draft completion, and API client functions.

**CSS**

The interface uses custom CSS for the dark ThunderDraft visual theme, responsive layouts, draft cards, player tables, roster displays, status indicators, modals, and mobile support.

### Backend

**Python**

Python is used for the ThunderDraft backend, data processing, API integration, caching, player matching, statistics processing, and SQLite persistence.

**FastAPI**

FastAPI provides the backend REST API. It serves player data, statistics, health information, the complete draft pool, and the active draft state.

**Pydantic**

Pydantic validates API request and response models. It ensures draft state, players, draft picks, and statistics use the expected structure before data is accepted or returned.

**Uvicorn**

Uvicorn runs the FastAPI application inside the backend Docker container.

**SQLite**

SQLite stores the active draft state in a persistent database file. It was selected because ThunderDraft currently supports one active league and does not require a separate database service.

### Infrastructure

**Docker**

Docker packages the frontend and backend into separate containers with consistent dependencies and runtime environments.

**Docker Compose**

Docker Compose manages the ThunderDraft services, persistent storage mounts, health checks, ports, container startup, and service dependencies.

**Nginx**

Nginx serves the production React frontend and proxies `/api` requests to the FastAPI backend.

**Tailscale**

Tailscale can provide secure private access to ThunderDraft from approved devices without exposing the application directly to the public internet.

**Uptime Kuma**

Uptime Kuma can monitor the ThunderDraft health endpoint and draft-state endpoint to verify that the frontend proxy, backend API, and SQLite database access are working.

**systemd**

A systemd service can start and recover the ThunderDraft Docker environment automatically after the host server boots.

## Data Sources

ThunderDraft currently combines data from multiple sources.

### Sleeper

Sleeper provides current player directory information such as:

- Player IDs
- Names
- NFL teams
- Positions
- Active status
- Injury status
- Depth-chart information
- Player images

### Fantasy Football Calculator

Fantasy Football Calculator provides 2026 half-PPR ADP data for 12-team leagues.

ADP information may include:

- Average draft position
- Market rank
- Position rank
- High draft position
- Low draft position
- Standard deviation
- Number of recorded drafts

### nflverse

nflverse provides historical NFL statistics used for player performance pages and multi-season fantasy analysis.

## Application Architecture

```text
Browser
   |
   v
Nginx
   |
   +---- React frontend
   |
   +---- /api reverse proxy
              |
              v
        FastAPI backend
          |         |
          |         +---- Cached player and statistics data
          |
          +-------------- SQLite draft database
```

The browser does not directly contact the external player-data providers.

The FastAPI backend retrieves, processes, matches, and caches public data. The React frontend then requests the completed player pool through ThunderDraft's own API.

## API Endpoints

### Health

```http
GET /api/health
```

Returns the backend health status.

### Player Directory

```http
GET /api/players
```

Returns the cached current NFL player directory.

### Player Cache Status

```http
GET /api/players/status
```

Returns information about the current player cache.

### Player Statistics

```http
GET /api/stats/players?season=2025
```

Returns ranked player statistics for a selected season.

```http
GET /api/stats/players/{gsis_id}/history
```

Returns all available historical seasons for one player.

### Draft Player Pool

```http
GET /api/draft/players
```

Returns the complete processed fantasy draft pool.

### Active Draft State

```http
GET /api/draft/state
```

Loads the active draft from SQLite.

```http
PUT /api/draft/state
```

Creates or updates the active draft.

```http
DELETE /api/draft/state
```

Deletes the active saved draft.

## Project Structure

```text
ThunderDraft/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   ├── services/
│   │   └── main.py
│   ├── data/
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── data/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── App.css
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Running ThunderDraft

### Requirements

- Docker
- Docker Compose
- Git

### Clone the Repository

```bash
git clone git@github.com:ZakFaarah1/ThunderDraft.git
cd ThunderDraft
```

### Environment File

Create a local `.env` file containing the environment values required by `docker-compose.yml`.

Do not commit `.env`.

### Start the Application

```bash
docker-compose up -d --build
```

The application is normally available at:

```text
http://localhost:5050
```

### Check Container Health

```bash
docker-compose ps
```

### Stop the Application

```bash
docker-compose down
```

Persistent draft data remains stored under `backend/data`.

## Development

### Run Frontend Tests

```bash
cd frontend
npm test -- --run
```

### Build the Frontend

```bash
cd frontend
npm run build
```

### Validate Backend Python Files

```bash
python3 -m compileall -q backend/app
```

## SQLite Storage

The local SQLite database is stored at:

```text
backend/data/thunderdraft.sqlite3
```

Inside the backend container, it is available at:

```text
/app/data/thunderdraft.sqlite3
```

View the active draft state:

```bash
curl -fsS http://localhost:5050/api/draft/state | python3 -m json.tool
```

## Current Scope

ThunderDraft is currently optimized for:

- One active league
- 12 fantasy teams
- Half-PPR scoring
- Snake drafts
- 15 roster spots
- Manual pick recording
- One commissioner or operator controlling the draft

## Future Roadmap

Potential future improvements include:

- User accounts
- Multiple leagues
- Configurable league sizes
- Standard PPR settings
- Full-PPR settings
- Superflex support
- TE-premium support
- Keeper leagues
- Mock-draft simulator
- Shareable spectator board
- Commissioner permissions
- Custom rankings
- CSV import and export
- Draft report cards
- Weekly waiver recommendations
- Trade analysis
- PostgreSQL support
- Simultaneous-edit protection
- Public hosted version
- Seasonal paid plans

## Commercial Use

Before offering ThunderDraft commercially, the usage rights for every external API, dataset, image source, logo, and trademark should be reviewed.

Publicly accessible data does not automatically include commercial redistribution rights.

## License

No open-source license has been selected yet.

Until a license is added, the repository remains under standard copyright protection.

## Author

Built by [Zakaria Faarah](https://github.com/ZakFaarah1).
