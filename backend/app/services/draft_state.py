import os
import sqlite3
from datetime import (
    datetime,
    timezone,
)
from pathlib import Path
from threading import Lock

from app.models.draft_state import (
    DraftStateDeleteResponse,
    DraftStateResponse,
    DraftStateUpsert,
)


_database_path = Path(
    os.getenv(
        "THUNDERDRAFT_DATABASE_PATH",
        "/app/data/thunderdraft.sqlite3",
    ),
)

_database_lock = Lock()


def _connect() -> sqlite3.Connection:
    """Opens the persistent ThunderDraft database."""

    _database_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    connection = sqlite3.connect(
        _database_path,
        timeout=30,
    )

    connection.row_factory = sqlite3.Row

    return connection


def initialize_draft_state_database() -> None:
    """Creates the draft-state table when missing."""

    with _database_lock:
        with _connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS draft_state (
                    id INTEGER PRIMARY KEY
                        CHECK (id = 1),
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """,
            )


def _validate_draft_state(
    state: DraftStateUpsert,
) -> None:
    """Rejects duplicate or inconsistent saved picks."""

    if (
        len(state.draftOrder) !=
        len(set(state.draftOrder))
    ):
        raise ValueError(
            "Draft order contains duplicate teams.",
        )

    pick_ids = [
        pick.id
        for pick in state.picks
    ]

    if len(pick_ids) != len(set(pick_ids)):
        raise ValueError(
            "Draft contains duplicate pick identifiers.",
        )

    player_ids = [
        pick.player.id
        for pick in state.picks
    ]

    if (
        len(player_ids) !=
        len(set(player_ids))
    ):
        raise ValueError(
            "A player cannot be drafted more than once.",
        )

    overall_picks = sorted(
        pick.overallPick
        for pick in state.picks
    )

    expected_picks = list(
        range(
            1,
            len(state.picks) + 1,
        ),
    )

    if overall_picks != expected_picks:
        raise ValueError(
            "Overall picks must form an uninterrupted sequence.",
        )

    if state.draftOrder:
        valid_team_ids = set(
            state.draftOrder,
        )

        invalid_team_pick = next(
            (
                pick
                for pick in state.picks
                if pick.fantasyTeamId
                not in valid_team_ids
            ),
            None,
        )

        if invalid_team_pick:
            raise ValueError(
                "A saved pick references a team "
                "outside the draft order.",
            )


def get_draft_state() -> DraftStateResponse:
    """Returns the active saved draft or an empty state."""

    initialize_draft_state_database()

    with _database_lock:
        with _connect() as connection:
            row = connection.execute(
                """
                SELECT payload, updated_at
                FROM draft_state
                WHERE id = 1
                """,
            ).fetchone()

    if row is None:
        return DraftStateResponse(
            draftOrder=[],
            picks=[],
            updatedAt=None,
        )

    state = DraftStateUpsert.model_validate_json(
        row["payload"],
    )

    return DraftStateResponse(
        draftOrder=state.draftOrder,
        picks=state.picks,
        updatedAt=row["updated_at"],
    )


def save_draft_state(
    state: DraftStateUpsert,
) -> DraftStateResponse:
    """Creates or replaces the active saved draft."""

    _validate_draft_state(
        state,
    )

    initialize_draft_state_database()

    updated_at = datetime.now(
        timezone.utc,
    ).isoformat()

    payload = state.model_dump_json()

    with _database_lock:
        with _connect() as connection:
            connection.execute(
                """
                INSERT INTO draft_state (
                    id,
                    payload,
                    updated_at
                )
                VALUES (1, ?, ?)
                ON CONFLICT(id)
                DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = excluded.updated_at
                """,
                (
                    payload,
                    updated_at,
                ),
            )

    return DraftStateResponse(
        draftOrder=state.draftOrder,
        picks=state.picks,
        updatedAt=updated_at,
    )


def delete_draft_state() -> DraftStateDeleteResponse:
    """Deletes the active saved draft."""

    initialize_draft_state_database()

    with _database_lock:
        with _connect() as connection:
            cursor = connection.execute(
                """
                DELETE FROM draft_state
                WHERE id = 1
                """,
            )

    return DraftStateDeleteResponse(
        deleted=cursor.rowcount > 0,
    )
