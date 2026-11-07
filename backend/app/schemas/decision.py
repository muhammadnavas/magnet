import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator


class AlternativeIn(BaseModel):
    name: str = Field(min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=2000)


class EventIn(BaseModel):
    alternative: str = Field(min_length=1, max_length=240)
    title: str = Field(min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=4000)
    event_type: Literal["milestone", "opportunity", "risk", "checkpoint", "decision"] = "milestone"
    offset_days: int = Field(ge=0, le=3650)


class DecisionCreate(BaseModel):
    title: str = Field(min_length=3, max_length=240)
    context: str = Field(min_length=10, max_length=12000)
    horizon_days: int = Field(default=90, ge=7, le=3650)
    alternatives: list[AlternativeIn] = Field(min_length=2, max_length=8)
    uncertainties: list[str] = Field(default_factory=list, max_length=20)
    events: list[EventIn] = Field(default_factory=list, max_length=100)

    @field_validator("alternatives")
    @classmethod
    def unique_alternatives(cls, values):
        names = [item.name.strip().casefold() for item in values]
        if len(names) != len(set(names)):
            raise ValueError("Alternative names must be unique")
        return values


class DecisionUpdate(BaseModel):
    status: Literal["exploring", "decided", "closed"] | None = None
    selected_alternative: str | None = Field(default=None, max_length=240)


class DecisionEventCreate(EventIn):
    pass


class DecisionEventOut(BaseModel):
    id: uuid.UUID
    decision_id: uuid.UUID
    alternative: str
    title: str
    description: str | None
    event_type: str
    offset_days: int
    is_user_defined: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DecisionOut(BaseModel):
    id: uuid.UUID
    title: str
    context: str
    horizon_days: int
    alternatives: list[dict]
    uncertainties: list[str]
    status: str
    selected_alternative: str | None
    created_at: datetime
    updated_at: datetime
    events: list[DecisionEventOut] = []
    model_config = ConfigDict(from_attributes=True)
