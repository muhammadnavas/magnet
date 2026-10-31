import hashlib
import uuid
import logging
import re
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User
from app.models.finance import FinanceTransaction
from app.schemas.finance import FinanceTransactionOut, FinanceTransactionUpdate, FinanceInsightRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/finance", tags=["Finance Intelligence"])

PAYMENT_TERMS = re.compile(r"\b(paid|payment|debited|debit|sent|transferred|received|credited|credit|spent|purchase|transaction)\b", re.I)
AMOUNT_RE = re.compile(r"(?:₹|INR|Rs\.?\s*)\s?([\d,]+(?:\.\d{1,2})?)|\b(?:amount|for)\s*(?:₹|INR|Rs\.?\s*)?([\d,]+(?:\.\d{1,2})?)", re.I)
MERCHANT_RE = re.compile(r"\b(?:to|at|from|towards)\s+([A-Za-z0-9][A-Za-z0-9 &._'-]{1,60}?)(?=\s+(?:via|using|on|ref|upi|txn|transaction|\bUPI\b)|[.,;\n]|$)", re.I)

CATEGORY_RULES = {
    "Food": ("swiggy", "zomato", "restaurant", "cafe", "food", "dominos", "mcdonald"),
    "Travel": ("uber", "ola", "rapido", "irctc", "metro", "flight", "fuel", "petrol"),
    "Shopping": ("amazon", "flipkart", "myntra", " meesho", "store", "mall"),
    "Bills": ("electricity", "bescom", "water", "recharge", "airtel", "jio", "vi ", "broadband"),
    "Entertainment": ("netflix", "spotify", "prime video", "hotstar", "bookmyshow"),
    "Health": ("pharmacy", "hospital", "clinic", "apollo", "medplus"),
}

class NotificationIngest(BaseModel):
    package_name: str = Field(max_length=255)
    app_name: str = Field(default="Payment app", max_length=120)
    title: str = Field(default="", max_length=300)
    text: str = Field(default="", max_length=2000)
    posted_at: int

def categorize(merchant: str) -> str:
    value = merchant.lower()
    for category, words in CATEGORY_RULES.items():
        if any(word.strip() in value for word in words):
            return category
    return "Other"

def parse_payment(payload: NotificationIngest):
    message = f"{payload.title} {payload.text}".strip()
    if not PAYMENT_TERMS.search(message):
        return None
    match = AMOUNT_RE.search(message)
    if not match:
        return None
    amount_text = next((group for group in match.groups() if group), "").replace(",", "")
    try:
        amount = Decimal(amount_text)
    except InvalidOperation:
        return None
    if amount <= 0 or amount > Decimal("100000000"):
        return None
    merchant_match = MERCHANT_RE.search(message)
    merchant = merchant_match.group(1).strip(" .:-") if merchant_match else payload.title.strip() or payload.app_name
    if len(merchant) < 2:
        merchant = payload.app_name or "Unknown merchant"
    lowered = message.lower()
    is_income = bool(re.search(r"\b(received|credited|credit)\b", lowered)) and not bool(re.search(r"\b(debited|paid|sent|spent)\b", lowered))
    occurred = datetime.fromtimestamp(payload.posted_at / 1000, tz=timezone.utc)
    fingerprint = hashlib.sha256(f"{payload.package_name}|{amount}|{merchant.lower()}|{int(occurred.timestamp() // 60)}|{message[:180]}".encode()).hexdigest()
    return {
        "amount": amount, "merchant": merchant[:255], "category": categorize(merchant),
        "transaction_type": "income" if is_income else "expense",
        "occurred_at": occurred, "fingerprint": fingerprint,
    }

@router.post("/ingest-notification")
async def ingest_notification(payload: NotificationIngest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    parsed = parse_payment(payload)
    if not parsed:
        return {"stored": False, "reason": "not_a_supported_payment_notification"}
    existing = await db.execute(select(FinanceTransaction.id).where(FinanceTransaction.fingerprint == parsed["fingerprint"]))
    if existing.scalar_one_or_none():
        return {"stored": False, "duplicate": True}
    transaction = FinanceTransaction(**parsed, currency="INR", source_app=payload.app_name[:120], source_package=payload.package_name[:255])
    db.add(transaction)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Could not store finance notification")
        return {"stored": False, "reason": "storage_error"}
    return {"stored": True, "transaction_id": str(transaction.id)}

@router.get("/transactions", response_model=list[FinanceTransactionOut])
async def list_transactions(month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"), limit: int = Query(default=100, ge=1, le=500), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(FinanceTransaction).order_by(FinanceTransaction.occurred_at.desc()).limit(limit)
    if month:
        try:
            start = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
            end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
            query = select(FinanceTransaction).where(FinanceTransaction.occurred_at >= start, FinanceTransaction.occurred_at < end).order_by(FinanceTransaction.occurred_at.desc()).limit(limit)
        except ValueError:
            raise HTTPException(400, "Invalid month")
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/summary")
async def finance_summary(month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    start = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc) if month else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    rows = (await db.execute(select(FinanceTransaction).where(FinanceTransaction.occurred_at >= start, FinanceTransaction.occurred_at < end))).scalars().all()
    expenses = [row for row in rows if row.transaction_type == "expense"]
    income = [row for row in rows if row.transaction_type == "income"]
    categories = {}
    for row in expenses:
        categories[row.category] = categories.get(row.category, Decimal("0")) + row.amount
    total_expense = sum((row.amount for row in expenses), Decimal("0"))
    total_income = sum((row.amount for row in income), Decimal("0"))
    return {
        "month": start.strftime("%Y-%m"), "expense": float(total_expense), "income": float(total_income),
        "net": float(total_income-total_expense), "transaction_count": len(rows),
        "category_breakdown": [{"category": key, "amount": float(value)} for key, value in sorted(categories.items(), key=lambda item: item[1], reverse=True)],
        "largest_expense": max((float(row.amount) for row in expenses), default=0),
    }

@router.patch("/transactions/{transaction_id}", response_model=FinanceTransactionOut)
async def update_transaction(transaction_id: str, payload: FinanceTransactionUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        parsed_id = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(400, "Invalid transaction ID")
    row = await db.get(FinanceTransaction, parsed_id)
    if not row:
        raise HTTPException(404, "Transaction not found")
    if payload.category is not None: row.category = payload.category.strip() or "Other"
    if payload.merchant is not None: row.merchant = payload.merchant.strip() or row.merchant
    if payload.note is not None: row.note = payload.note
    await db.commit()
    await db.refresh(row)
    return row

@router.delete("/transactions/{transaction_id}", status_code=204)
async def delete_transaction(transaction_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        parsed_id = uuid.UUID(transaction_id)
    except ValueError:
        raise HTTPException(400, "Invalid transaction ID")
    row = await db.get(FinanceTransaction, parsed_id)
    if not row: raise HTTPException(404, "Transaction not found")
    await db.delete(row)
    await db.commit()

@router.post("/ask")
async def ask_finance(payload: FinanceInsightRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (await db.execute(select(FinanceTransaction).order_by(FinanceTransaction.occurred_at.desc()).limit(500))).scalars().all()
    q = payload.question.lower()
    if "food" in q: rows = [r for r in rows if r.category == "Food"]
    elif "travel" in q: rows = [r for r in rows if r.category == "Travel"]
    elif "shopping" in q: rows = [r for r in rows if r.category == "Shopping"]
    elif "income" in q or "received" in q: rows = [r for r in rows if r.transaction_type == "income"]
    else: rows = [r for r in rows if r.transaction_type == "expense"]
    total = sum((r.amount for r in rows), Decimal("0"))
    if "biggest" in q or "largest" in q:
        biggest = max(rows, key=lambda r: r.amount, default=None)
        answer = f"Your largest matching transaction is ₹{biggest.amount:,.2f} at {biggest.merchant}." if biggest else "I couldn't find matching transactions yet."
    elif "how many" in q or "count" in q:
        answer = f"I found {len(rows)} matching transactions."
    else:
        answer = f"Based on the {len(rows)} stored matching transactions, the total is ₹{total:,.2f}. This is based only on notifications Magnet has successfully captured."
    return {"answer": answer, "transactions_considered": len(rows)}
