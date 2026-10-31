import uuid
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

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
