import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator

class FinanceTransactionOut(BaseModel):
    id: uuid.UUID
    amount: Decimal
    currency: str
    merchant: str
    category: str
    transaction_type: str
    source_app: str
    occurred_at: datetime
    created_at: datetime
    model_config = {"from_attributes": True}

class FinanceTransactionUpdate(BaseModel):
    category: str | None = Field(default=None, max_length=50)
    merchant: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=500)

class FinanceInsightRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)

class FinanceLimitInput(BaseModel):
    category: str | None = Field(default=None, max_length=50)
    amount: Decimal = Field(gt=0, le=Decimal("100000000"))
    enabled: bool = True
    timezone_offset_minutes: int = Field(default=-330, ge=-840, le=840)

class FinancePushTokenInput(BaseModel):
    expo_push_token: str = Field(min_length=10, max_length=255)
    platform: str = Field(default="android", pattern="^(android|ios)$")
