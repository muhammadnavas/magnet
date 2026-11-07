import json
from datetime import datetime, timedelta, timezone
from app.utils.ai import get_completion


def build_timeline(decision, events):
    start = decision.created_at or datetime.now(timezone.utc).replace(tzinfo=None)
    timeline = []
    for alternative in decision.alternatives or []:
        name = alternative["name"]
        branch_events = [event for event in events if event.alternative in (name, "*")]
        if not branch_events:
            branch_events = [
                {"title": "Review progress and new information", "description": "Suggested checkpoint. Update this timeline when something changes.", "event_type": "checkpoint", "offset_days": min(30, decision.horizon_days), "source": "suggested_checkpoint"},
                {"title": "Reassess this path", "description": "Compare what happened with the assumptions behind this option.", "event_type": "decision", "offset_days": decision.horizon_days, "source": "suggested_checkpoint"},
            ]
        for event in branch_events:
            offset = event.offset_days if hasattr(event, "offset_days") else event["offset_days"]
            title = event.title if hasattr(event, "title") else event["title"]
            description = event.description if hasattr(event, "description") else event.get("description")
            event_type = event.event_type if hasattr(event, "event_type") else event["event_type"]
            source = ("user_input" if event.is_user_defined else "ai_generated") if hasattr(event, "is_user_defined") else event.get("source", "suggested_checkpoint")
            event_id = str(event.id) if hasattr(event, "id") else None
            selected_option = event.selected_follow_up_option if hasattr(event, "selected_follow_up_option") else event.get("selected_follow_up_option")
            timeline.append({"id": event_id, "selected_follow_up_option": selected_option, "alternative": name, "title": title, "description": description, "event_type": event_type, "offset_days": offset, "follow_up_options": event.follow_up_options if hasattr(event, "follow_up_options") else event.get("follow_up_options", []), "expected_date": (start + timedelta(days=offset)).date().isoformat(), "source": source})
    return sorted(timeline, key=lambda item: (item["offset_days"], item["alternative"]))


def build_analysis(decision, events):
    timeline = build_timeline(decision, events)
    return {
        "decision_id": str(decision.id),
        "horizon_days": decision.horizon_days,
        "alternatives": [{"name": item["name"], "parent_alternative": item.get("parent_alternative"), "description": item.get("description"), "timeline": [event for event in timeline if event["alternative"] == item["name"]]} for item in decision.alternatives],
        "shared_events": [event for event in timeline if event["alternative"] == "*"],
        "uncertainties": decision.uncertainties or [],
        "methodology": {"probabilities": "not_estimated", "outcome_predictions": "scenario_hypotheses_only", "note": "AI-generated events are plausible scenarios, not predictions or promises. Dates are planning estimates from the decision creation date. Revisit when facts change."},
    }


async def generate_scenario_events(decision):
    alternatives = [item["name"] for item in decision.alternatives]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    decision_start = decision.created_at.replace(tzinfo=None) if decision.created_at.tzinfo else decision.created_at
    elapsed_days = max(0, (now - decision_start).days)
    remaining_days = max(30, decision.horizon_days - elapsed_days)
    prompt_data = {"decision": decision.title, "context": decision.context, "alternatives": alternatives, "remaining_days": remaining_days, "days_elapsed": elapsed_days, "uncertainties": decision.uncertainties or []}
    system_prompt = (
        "You are a careful decision-planning analyst. Generate possible futures, not advice. Treat only supplied details as facts. "
        "Every event must be conditional or hypothetical, never certain. Never invent probabilities, scores, statistics, salary figures, "
        "promises, or guaranteed outcomes. Include 2 to 4 useful events for EACH alternative across the time horizon, including risks, "
        "opportunities, checkpoints, and new decision points. For each event of type decision, include 2 to 4 follow_up_options that represent possible next choices; otherwise use an empty array. Return ONLY JSON with shape "
        '{"events":[{"alternative":"exact alternative name","title":"short title","description":"conditional explanation","event_type":"milestone|opportunity|risk|checkpoint|decision","offset_days":30,"follow_up_options":["choice A","choice B"]}]} '
        "Use event_type from the listed values and offset_days is days from TODAY, from 1 through remaining_days."
    )
    raw = await get_completion(system_prompt, json.dumps(prompt_data, ensure_ascii=False))
    if not raw or raw.startswith("AI unavailable"):
        raise RuntimeError(raw or "Configured AI provider returned no response.")
    cleaned = raw.strip()
    tick = chr(96)
    if cleaned.startswith(tick * 3):
        cleaned = cleaned.replace(tick * 3 + "json", "").replace(tick * 3, "").strip()
    data = json.loads(cleaned)
    if not isinstance(data, dict) or not isinstance(data.get("events"), list):
        raise ValueError("AI response did not contain an events array.")
    valid_types = {"milestone", "opportunity", "risk", "checkpoint", "decision"}
    output = []
    for item in data["events"]:
        if not isinstance(item, dict) or item.get("alternative") not in alternatives:
            continue
        title = str(item.get("title", "")).strip()[:240]
        description = str(item.get("description", "")).strip()[:4000]
        try:
            offset = int(item.get("offset_days"))
        except (TypeError, ValueError):
            continue
        event_type = item.get("event_type")
        if title and description and event_type in valid_types and 1 <= offset <= remaining_days:
            options = item.get("follow_up_options", [])
            if not isinstance(options, list):
                options = []
            options = [str(option).strip()[:240] for option in options if str(option).strip()][:8]
            output.append({"alternative": item["alternative"], "title": title, "description": description, "event_type": event_type, "offset_days": offset, "follow_up_options": options})
    if not output:
        raise ValueError("AI could not produce valid scenario events. Add more context or uncertainties and try again.")
    return output
