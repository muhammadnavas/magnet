import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut
from app.models.decision import Decision, DecisionEvent
from app.schemas.decision import DecisionCreate, DecisionUpdate, DecisionOut, DecisionEventCreate, DecisionEventOut, DecisionEventUpdate
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
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    decision_start = decision.created_at.replace(tzinfo=None) if decision.created_at.tzinfo else decision.created_at
    # User-entered event timing is relative to today; persist it as an offset
    # from the decision start so the complete timeline remains consistently ordered.
    absolute_offset = max(0, (now - decision_start).days) + payload.offset_days
    if absolute_offset > decision.horizon_days:
        decision.horizon_days = absolute_offset
    event_data = payload.model_dump()
    event_data["offset_days"] = absolute_offset
    event = DecisionEvent(decision_id=decision.id, **event_data, is_user_defined=True)
    decision.updated_at = now
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
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    decision_start = decision.created_at.replace(tzinfo=None) if decision.created_at.tzinfo else decision.created_at
    elapsed_days = max(0, (now - decision_start).days)
    for item in generated:
        item["offset_days"] = elapsed_days + item["offset_days"]
        db.add(DecisionEvent(decision_id=decision.id, **item, is_user_defined=False))
        decision.horizon_days = max(decision.horizon_days, item["offset_days"])
    decision.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    return {"generated_events": len(generated), "timeline": build_analysis(decision, await _load_events(db, decision.id))}


async def _load_events(db: AsyncSession, decision_id: uuid.UUID):
    result = await db.execute(select(DecisionEvent).where(DecisionEvent.decision_id == decision_id))
    return result.scalars().all()


@router.patch("/{decision_id}/events/{event_id}")
async def choose_follow_up(
    decision_id: uuid.UUID,
    event_id: uuid.UUID,
    payload: DecisionEventUpdate,
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    decision = await _get_decision(db, decision_id)
    result = await db.execute(
        select(DecisionEvent).where(
            DecisionEvent.id == event_id,
            DecisionEvent.decision_id == decision.id,
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Timeline event not found")
    if event.event_type != "decision" or payload.selected_follow_up_option not in (event.follow_up_options or []):
        raise HTTPException(status_code=422, detail="Choose one of the available follow-up options on a decision event")

    parent_path = payload.parent_alternative or event.alternative
    valid_paths = [item["name"] for item in decision.alternatives]
    if parent_path not in valid_paths or (event.alternative != "*" and parent_path != event.alternative):
        raise HTTPException(status_code=422, detail="This event does not belong to the selected timeline path")

    child_name = f"{parent_path} → {payload.selected_follow_up_option}"[:240]
    existing_alternatives = {item["name"] for item in decision.alternatives}
    if child_name in existing_alternatives:
        return {"event": event, "new_alternative": child_name, "parent_alternative": parent_path}

    # Shared events appear on every path. Fork the event into the selected path
    # before saving the choice, so another path is not changed accidentally.
    if event.alternative == "*":
        # Hide the shared copy only on the path being forked; other paths keep it.
        updated_alternatives = []
        for alternative in decision.alternatives:
            if alternative["name"] == parent_path:
                excluded = list(alternative.get("excluded_shared_event_ids", []))
                if str(event.id) not in excluded:
                    excluded.append(str(event.id))
                alternative = {**alternative, "excluded_shared_event_ids": excluded}
            updated_alternatives.append(alternative)
        decision.alternatives = updated_alternatives
        db.add(DecisionEvent(
            decision_id=decision.id, alternative=parent_path, title=event.title,
            description=event.description, event_type=event.event_type,
            offset_days=event.offset_days, is_user_defined=event.is_user_defined,
            follow_up_options=event.follow_up_options or [],
            selected_follow_up_option=payload.selected_follow_up_option,
        ))
    else:
        event.selected_follow_up_option = payload.selected_follow_up_option

    existing = [item["name"] for item in decision.alternatives]
    if child_name not in existing:
        parent_metadata = next(item for item in decision.alternatives if item["name"] == parent_path)
        decision.alternatives = decision.alternatives + [{
            "name": child_name,
            "parent_alternative": parent_path,
            "excluded_shared_event_ids": list(parent_metadata.get("excluded_shared_event_ids", [])),
            "description": f"Explore the future of {parent_path} after choosing: {payload.selected_follow_up_option}",
        }]
        prior = await db.execute(
            select(DecisionEvent).where(
                DecisionEvent.decision_id == decision.id,
                DecisionEvent.alternative == parent_path,
                DecisionEvent.offset_days <= event.offset_days,
            )
        )
        for previous in prior.scalars().all():
            if previous.id == event.id:
                continue
            db.add(DecisionEvent(
                decision_id=decision.id,
                alternative=child_name,
                title=previous.title,
                description=previous.description,
                event_type=previous.event_type,
                offset_days=previous.offset_days,
                is_user_defined=previous.is_user_defined,
                follow_up_options=previous.follow_up_options or [],
                selected_follow_up_option=previous.selected_follow_up_option,
            ))
        db.add(DecisionEvent(
            decision_id=decision.id,
            alternative=child_name,
            title=f"Decision made: {payload.selected_follow_up_option}",
            description="This is a new branch based on the choice you selected. Add future events as new information becomes available.",
            event_type="checkpoint",
            offset_days=event.offset_days,
            is_user_defined=True,
        ))
    decision.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(event)
    return {"event": event, "new_alternative": child_name, "parent_alternative": parent_path}


@router.delete("/{decision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_decision(
    decision_id: uuid.UUID,
    current_user: UserOut = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    decision = await _get_decision(db, decision_id)
    await db.delete(decision)
    await db.commit()
