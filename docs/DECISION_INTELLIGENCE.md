# Decision Intelligence

Decision Intelligence adds an assumption-led decision workspace to Magnet.

## User flow

1. Create a decision with context, a time horizon, at least two alternatives, and known uncertainties.
2. Generate AI scenario hypotheses for each alternative.
3. Review the time-based event timeline for each path.
4. Add new events as they become known. Event dates entered by the user are relative to today and are stored on the original decision timeline.
5. When a decision-point event offers follow-up choices, select one to create a nested child timeline. The child inherits the history up to that point and can be simulated independently.
6. Record the current choice. The decision can be revisited and updated as circumstances change.

## API

All endpoints are under /api/v1 and use Magnet's existing personal-profile dependency.

- GET /decisions — list decisions.
- POST /decisions — create a decision.
- GET /decisions/{id} — retrieve a decision and events.
- PATCH /decisions/{id} — update status or record the selected alternative.
- DELETE /decisions/{id} — delete a decision and its events.
- GET /decisions/{id}/timeline — retrieve all scenario branches and timeline metadata.
- POST /decisions/{id}/events — add a user-defined event to one path or all paths (alternative: "*").
- PATCH /decisions/{id}/events/{event_id} — select a follow-up option and create a nested timeline branch.
- POST /decisions/{id}/simulate — ask the configured Magnet LLM provider to generate scenario hypotheses.

## AI and safety design

The scenario generator uses Magnet's existing get_completion abstraction, so the configured Gemini/Grok provider is reused. It validates the model response before persisting it. Re-running simulation replaces only AI-generated events and preserves user-entered events.

The engine does not generate numerical probabilities, success scores, or guaranteed outcomes. AI events are explicitly labelled hypothetical. Timeline dates are calculated from the decision creation date; user-added and AI-generated future events are anchored to the current date when created.

## Database

Alembic revision 20261107_01 creates:

- decisions: decision context, alternatives, uncertainties, status, and selected alternative.
- decision_events: path-specific milestones, risks, opportunities, checkpoints, and decision points.

The backend Docker startup already runs alembic upgrade head, so the migration is applied on the next deployment/startup.
