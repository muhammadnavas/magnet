from datetime import datetime, timedelta, timezone


def build_timeline(decision, events):
    """Build an honest, assumption-led timeline; never invent outcome probabilities."""
    start = decision.created_at or datetime.now(timezone.utc).replace(tzinfo=None)
    alternatives = decision.alternatives or []
    timeline = []
    for alternative in alternatives:
        name = alternative["name"]
        branch_events = [event for event in events if event.alternative in (name, "*")]
        if not branch_events:
            # Neutral review checkpoints, not predictions or claims about outcomes.
            branch_events = [
                {
                    "title": "Review progress and new information",
                    "description": "A suggested checkpoint. Update this timeline when something changes.",
                    "event_type": "checkpoint",
                    "offset_days": min(30, decision.horizon_days),
                },
                {
                    "title": "Reassess this path",
                    "description": "Compare what actually happened with the assumptions behind this option.",
                    "event_type": "decision",
                    "offset_days": decision.horizon_days,
                },
            ]
        for event in branch_events:
            offset = event.offset_days if hasattr(event, "offset_days") else event["offset_days"]
            title = event.title if hasattr(event, "title") else event["title"]
            description = event.description if hasattr(event, "description") else event.get("description")
            event_type = event.event_type if hasattr(event, "event_type") else event["event_type"]
            timeline.append({
                "alternative": name,
                "title": title,
                "description": description,
                "event_type": event_type,
                "offset_days": offset,
                "expected_date": (start + timedelta(days=offset)).date().isoformat(),
                "source": "user_input" if getattr(event, "is_user_defined", False) else "suggested_checkpoint",
            })
    return sorted(timeline, key=lambda item: (item["offset_days"], item["alternative"]))


def build_analysis(decision, events):
    timeline = build_timeline(decision, events)
    return {
        "decision_id": str(decision.id),
        "horizon_days": decision.horizon_days,
        "alternatives": [
            {
                "name": item["name"],
                "description": item.get("description"),
                "timeline": [event for event in timeline if event["alternative"] == item["name"]],
            }
            for item in decision.alternatives
        ],
        "shared_events": [event for event in timeline if event["alternative"] == "*"],
        "uncertainties": decision.uncertainties or [],
        "methodology": {
            "probabilities": "not_estimated",
            "outcome_predictions": "not_generated",
            "note": "Dates are calculated from the decision creation date. Checkpoints are planning prompts, not predictions. Add events as new information becomes available.",
        },
    }
