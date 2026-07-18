from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class DraftStatePlayer(BaseModel):
    """Stores the complete player snapshot for one pick."""

    model_config = ConfigDict(
        extra="allow",
    )

    id: str
    name: str
    nflTeam: str
    position: str


class DraftStatePick(BaseModel):
    """Stores one recorded fantasy draft selection."""

    id: str
    overallPick: int = Field(
        ge=1,
    )
    fantasyTeamId: str
    player: DraftStatePlayer


class DraftStateUpsert(BaseModel):
    """Represents the active league draft snapshot."""

    draftOrder: list[str] = Field(
        default_factory=list,
    )
    picks: list[DraftStatePick] = Field(
        default_factory=list,
    )


class DraftStateResponse(
    DraftStateUpsert,
):
    """Returns the saved draft and its update time."""

    updatedAt: str | None = None


class DraftStateDeleteResponse(BaseModel):
    """Reports whether a saved draft was deleted."""

    deleted: bool
