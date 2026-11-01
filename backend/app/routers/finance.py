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
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User
from app.models.finance import FinanceTransaction, FinanceLimit, FinancePushDevice, FinanceAlertEvent
from app.schemas.finance import FinanceTransactionOut, FinanceTransactionUpdate, FinanceInsightRequest, FinanceLimitInput, FinancePushTokenInput

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/finance", tags=["Finance Intelligence"])

# Keep this allowlist aligned with the Android listener plugin.
ALLOWED_PAYMENT_PACKAGES = {
    "com.google.android.apps.nbu.paisa.user", "com.phonepe.app",
    "net.one97.paytm", "in.org.npci.upiapp", "com.sbi.SBIFreedomPlus",
    "com.axis.mobile", "com.icicibank.imobile", "com.hdfcbank.android",
    "com.kotak811.app", "com.dreamplug.androidapp", "com.mobikwik_new",
}

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
    posted_at: int = Field(gt=0)

def categorize(merchant: str) -> str:
    value = merchant.lower()
    for category, words in CATEGORY_RULES.items():
        if any(word.strip() in value for word in words):
            return category
    return "Other"

def parse_payment(payload: NotificationIngest):
    message = f"{payload.title} {payload.text}".strip()
    if not message or SENSITIVE_NOTIFICATION_RE.search(message):
        return None
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


async def send_finance_push(db: AsyncSession, title: str, body: str, data: dict):
    devices = (await db.execute(select(FinancePushDevice).where(FinancePushDevice.enabled.is_(True)))).scalars().all()
    if not devices:
        return
    import httpx
    messages = [{
        "to": device.expo_push_token,
        "title": title,
        "body": body,
        "sound": "default",
        "channelId": "finance-alerts",
        "data": data,
    } for device in devices]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            response.raise_for_status()
            payload = response.json()
        for device, ticket in zip(devices, payload.get("data", [])):
            if ticket.get("status") == "error" and ticket.get("details", {}).get("error") == "DeviceNotRegistered":
                device.enabled = False
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Finance push delivery failed")


async def evaluate_spending_limits(db: AsyncSession):
    limits = (await db.execute(select(FinanceLimit).where(FinanceLimit.enabled.is_(True)))).scalars().all()
    for limit in limits:
        tz = timezone(timedelta(minutes=-limit.timezone_offset_minutes))
        now_local = datetime.now(tz)
        period_key = now_local.strftime("%Y-%m")
        start_local = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_local = (start_local.replace(day=28) + timedelta(days=4)).replace(day=1)
        start_utc, end_utc = start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)
        statement = select(func.coalesce(func.sum(FinanceTransaction.amount), 0)).where(
            FinanceTransaction.transaction_type == "expense",
            FinanceTransaction.occurred_at >= start_utc,
            FinanceTransaction.occurred_at < end_utc,
        )
        if limit.category:
            statement = statement.where(FinanceTransaction.category == limit.category)
        spent = Decimal(str((await db.execute(statement)).scalar_one()))
        for threshold in (50, 80, 100):
            if spent < limit.amount * Decimal(threshold) / Decimal(100):
                continue
            event_insert = pg_insert(FinanceAlertEvent).values(
                limit_id=limit.id, period_key=period_key,
                threshold_percent=threshold, spent_amount=spent,
            ).on_conflict_do_nothing(
                index_elements=["limit_id", "period_key", "threshold_percent"]
            ).returning(FinanceAlertEvent.id)
            try:
                event_id = (await db.execute(event_insert)).scalar_one_or_none()
                await db.commit()
            except Exception:
                await db.rollback()
                logger.exception("Could not record finance threshold event")
                continue
            if event_id:
                label = f"{limit.category} spending" if limit.category else "Monthly spending"
                title = f"{threshold}% of budget used"
                body = f"{label}: ₹{spent:,.0f} spent out of ₹{limit.amount:,.0f}."
                await send_finance_push(db, title, body, {
                    "type": "finance_threshold", "limit_id": str(limit.id),
                    "threshold": threshold, "period": period_key,
                })


@router.get("/limits")
async def get_finance_limits(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    limits = (await db.execute(select(FinanceLimit).order_by(FinanceLimit.category.asc().nullsfirst()))).scalars().all()
    return [{
        "id": str(item.id), "category": item.category, "amount": float(item.amount),
        "enabled": item.enabled, "timezone_offset_minutes": item.timezone_offset_minutes,
    } for item in limits]


@router.put("/limits")
async def save_finance_limit(payload: FinanceLimitInput, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    category = payload.category.strip().title() if payload.category else None
    if category and category.lower() in {"all", "monthly", "overall"}:
        category = None
    scope_key = f"category:{category.lower()}" if category else "monthly"
    limit = (await db.execute(select(FinanceLimit).where(FinanceLimit.scope_key == scope_key))).scalar_one_or_none()
    if limit is None:
        limit = FinanceLimit(scope_key=scope_key, category=category, amount=payload.amount,
                             enabled=payload.enabled, timezone_offset_minutes=payload.timezone_offset_minutes)
        db.add(limit)
    else:
        limit.amount = payload.amount
        limit.enabled = payload.enabled
        limit.timezone_offset_minutes = payload.timezone_offset_minutes
        limit.category = category
    await db.commit()
    await db.refresh(limit)
    return {"id": str(limit.id), "category": limit.category, "amount": float(limit.amount),
            "enabled": limit.enabled, "timezone_offset_minutes": limit.timezone_offset_minutes}


@router.delete("/limits/{limit_id}", status_code=204)
async def delete_finance_limit(limit_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        parsed_id = uuid.UUID(limit_id)
    except ValueError:
        raise HTTPException(400, "Invalid limit ID")
    limit = await db.get(FinanceLimit, parsed_id)
    if not limit:
        raise HTTPException(404, "Spending limit not found")
    await db.delete(limit)
    await db.commit()


@router.post("/push-token")
async def register_finance_push_token(payload: FinancePushTokenInput, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not payload.expo_push_token.startswith("ExponentPushToken["):
        raise HTTPException(422, "Invalid Expo push token")
    device = (await db.execute(select(FinancePushDevice).where(
        FinancePushDevice.expo_push_token == payload.expo_push_token
    ))).scalar_one_or_none()
    if device:
        device.enabled = True
        device.platform = payload.platform
    else:
        db.add(FinancePushDevice(expo_push_token=payload.expo_push_token, platform=payload.platform))
    await db.commit()
    return {"registered": True}


@router.get("/alerts")
async def list_finance_alerts(limit: int = Query(default=30, ge=1, le=100), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (await db.execute(
        select(FinanceAlertEvent, FinanceLimit)
        .join(FinanceLimit, FinanceAlertEvent.limit_id == FinanceLimit.id)
        .order_by(FinanceAlertEvent.created_at.desc()).limit(limit)
    )).all()
    return [{
        "id": str(event.id), "category": rule.category, "amount": float(rule.amount),
        "spent_amount": float(event.spent_amount), "threshold_percent": event.threshold_percent,
        "period": event.period_key, "created_at": event.created_at.isoformat(),
    } for event, rule in rows]


@router.post("/ingest-notification")
async def ingest_notification(payload: NotificationIngest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.package_name not in ALLOWED_PAYMENT_PACKAGES:
        raise HTTPException(status_code=403, detail="Unsupported payment notification source")

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    if payload.posted_at > now_ms + 5 * 60 * 1000 or payload.posted_at < now_ms - 45 * 24 * 60 * 60 * 1000:
        raise HTTPException(status_code=422, detail="Notification timestamp is outside the accepted window")

    parsed = parse_payment(payload)
    if not parsed:
        return {"stored": False, "reason": "not_a_supported_payment_notification"}

    # Atomic insert prevents duplicate callbacks racing between SELECT and INSERT.
    statement = (
        pg_insert(FinanceTransaction)
        .values(**parsed, currency="INR", source_app=payload.app_name[:120], source_package=payload.package_name)
        .on_conflict_do_nothing(index_elements=["fingerprint"])
        .returning(FinanceTransaction.id)
    )
    try:
        result = await db.execute(statement)
        transaction_id = result.scalar_one_or_none()
        await db.commit()
    except Exception:
        await db.rollback()
        logger.exception("Could not store finance notification")
        raise HTTPException(status_code=503, detail="Finance storage is temporarily unavailable")

    if transaction_id is None:
        return {"stored": False, "duplicate": True}
    try:
        await evaluate_spending_limits(db)
    except Exception:
        logger.exception("Spending limit evaluation failed after transaction ingest")
    return {"stored": True, "transaction_id": str(transaction_id)}

def get_month_bounds(month: str, tz_offset_minutes: int):
    # JavaScript getTimezoneOffset is UTC minus local time; negate it to
    # construct the user's local timezone and convert local month edges to UTC.
    local_timezone = timezone(timedelta(minutes=-tz_offset_minutes))
    local_start = datetime.strptime(month, "%Y-%m").replace(tzinfo=local_timezone)
    local_end = (local_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc)


@router.get("/transactions", response_model=list[FinanceTransactionOut])
async def list_transactions(
    month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(FinanceTransaction).order_by(FinanceTransaction.occurred_at.desc()).limit(limit)
    if month:
        try:
            start, end = get_month_bounds(month, tz_offset_minutes)
            query = select(FinanceTransaction).where(
                FinanceTransaction.occurred_at >= start,
                FinanceTransaction.occurred_at < end,
            ).order_by(FinanceTransaction.occurred_at.desc()).limit(limit)
        except ValueError:
            raise HTTPException(400, "Invalid month")
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/summary")
async def finance_summary(
    month: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if month:
        try:
            start, end = get_month_bounds(month, tz_offset_minutes)
        except ValueError:
            raise HTTPException(400, "Invalid month")
    else:
        now = datetime.now(timezone.utc)
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
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
        "month": month or start.strftime("%Y-%m"), "expense": float(total_expense), "income": float(total_income),
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
