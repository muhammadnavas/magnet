import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut
from app.models.decision import Decision, DecisionEvent
from app.schemas.decision import DecisionCreate, DecisionUpdate, DecisionOut, DecisionEventCreate, DecisionEventOut
from app.services.decision_engine import build_analysis, generate_scenario_events

router = APIRouter(prefix="/decisions", tags=["Decision Intelligence"])


async def _get_decision(db: AsyncSession, decision_id: uuid.UUID):
    result = await db.execute(
        select(Decision).where(Decision.id == decision_id).options(selectinload(Decision.events))
    )
    decision = result.scalar_one_or_none()
    if decision is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision


@router.get("", response_model=list[DecisionOut])
async def list_decisions(
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Decision).options(selectinload(Decision.events)).order_by(Decision.updated_at.desc()))
    return result.scalars().all()


@router.post("", response_model=DecisionOut, status_code=status.HTTP_201_CREATED)
async def create_decision(
    payload: DecisionCreate,
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    decision = Decision(
        title=payload.title.strip(),
        context=payload.context.strip(),
        horizon_days=payload.horizon_days,
        alternatives=[item.model_dump() for item in payload.alternatives],
        uncertainties=payload.uncertainties,
    )
    db.add(decision)
    await db.flush()
    for item in payload.events:
        if item.alternative != "*" and item.alternative not in [a.name for a in payload.alternatives]:
            raise HTTPException(status_code=422, detail=f"Unknown alternative: {item.alternative}")
        db.add(DecisionEvent(decision_id=decision.id, **item.model_dump(), is_user_defined=True))
    await db.commit()
    result = await db.execute(select(Decision).where(Decision.id == decision.id).options(selectinload(Decision.events)))
    return result.scalar_one()


@router.get("/{decision_id}", response_model=DecisionOut)
async def get_decision(
    decision_id: uuid.UUID,
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    decision = await _get_decision(db, decision_id)
    return decision


@router.patch("/{decision_id}", response_model=DecisionOut)
async def update_decision(
    decision_id: uuid.UUID,
    payload: DecisionUpdate,
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    decision = await _get_decision(db, decision_id)
    if payload.status is not None:
        decision.status = payload.status
    if payload.selected_alternative is not None:
        valid = [item["name"] for item in decision.alternatives]
        if payload.selected_alternative not in valid:
            raise HTTPException(status_code=422, detail="Selected alternative is not part of this decision")
        decision.selected_alternative = payload.selected_alternative
        decision.status = "decided"
    await db.commit()
    await db.refresh(decision)
    return decision


@router.post("/{decision_id}/events", response_model=DecisionEventOut, status_code=status.HTTP_201_CREATED)
async def add_event(
    decision_id: uuid.UUID,
    payload: DecisionEventCreate,
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    decision = await _get_decision(db, decision_id)
    if payload.alternative != "*" and payload.alternative not in [item["name"] for item in decision.alternatives]:
        raise HTTPException(status_code=422, detail="Event must belong to an existing alternative or '*' for all paths")
    if payload.offset_days > decision.horizon_days:
        decision.horizon_days = payload.offset_days
    event = DecisionEvent(decision_id=decision.id, **payload.model_dump(), is_user_defined=True)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.get("/{decision_id}/timeline")
async def get_timeline(
    decision_id: uuid.UUID,
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    decision = await _get_decision(db, decision_id)
    result = await db.execute(select(DecisionEvent).where(DecisionEvent.decision_id == decision.id))
    events = result.scalars().all()
    return build_analysis(decision, events)


@router.post("/{decision_id}/simulate")
async def simulate_decision(
    decision_id: uuid.UUID,
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    decision = await _get_decision(db, decision_id)
    try:
        generated = await generate_scenario_events(decision)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=502, detail=f"Could not validate AI scenario response: {exc}")

    # Replace previous AI suggestions while preserving events entered by the user.
    previous = await db.execute(
        select(DecisionEvent).where(
            DecisionEvent.decision_id == decision.id,
            DecisionEvent.is_user_defined.is_(False),
        )
    )
    for old_event in previous.scalars().all():
        await db.delete(old_event)
    for item in generated:
        db.add(DecisionEvent(decision_id=decision.id, **item, is_user_defined=False))
    decision.updated_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).replace(tzinfo=None)
    await db.commit()
    return {"generated_events": len(generated), "timeline": build_analysis(decision, await _load_events(db, decision.id))}


async def _load_events(db: AsyncSession, decision_id: uuid.UUID):
    result = await db.execute(select(DecisionEvent).where(DecisionEvent.decision_id == decision_id))
    return result.scalars().all()


@router.delete("/{decision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_decision(
    decision_id: uuid.UUID,
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    decision = await _get_decision(db, decision_id)
    await db.delete(decision)
    await db.commit()
