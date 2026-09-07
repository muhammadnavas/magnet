import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.personal_context import PersonalContext, PersonalContextFact

MAX_CONTEXT_TOKENS = 200
SEED_FACTS = [
    ("identity", "Muhammad Navas", 100),
    ("age", "21 years old", 80),
    ("role", "student and software engineering intern", 100),
    ("education", "studies at CMRIT", 100),
    ("work", "works on AI and software projects", 90),
    ("interest", "interested in AI and technology", 70),
]


def render_context(facts: list[PersonalContextFact]) -> str:
    ordered = sorted(facts, key=lambda f: (-f.priority, f.category, f.value))
    parts = [f.value.rstrip(".") for f in ordered[:12] if f.value.strip()]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0] + "."
    if len(parts) == 2:
        return f"{parts[0]} and {parts[1]}."
    return "; ".join(parts[:-1]) + ", and " + parts[-1] + "."


async def get_or_create_personal_context(db: AsyncSession) -> PersonalContext:
    result = await db.execute(select(PersonalContext).order_by(PersonalContext.updated_at.desc()).limit(1))
    context = result.scalars().first()
    if context:
        return context

    context = PersonalContext(context="", version=1)
    db.add(context)
    await db.flush()
    for category, value, priority in SEED_FACTS:
        db.add(PersonalContextFact(category=category, value=value, sources=["seed"], priority=priority))
    await db.flush()
    await rebuild_personal_context(db, context)
    return context


async def rebuild_personal_context(db: AsyncSession, context: PersonalContext | None = None) -> str:
    if context is None:
        context = await get_or_create_personal_context(db)
    result = await db.execute(select(PersonalContextFact))
    facts = list(result.scalars().all())
    context.context = render_context(facts)[:1200]
    context.version = (context.version or 0) + 1
    return context.context


async def add_knowledge_signals(db: AsyncSession, knowledge_id: uuid.UUID, analysis: dict) -> None:
    """Add only broad, durable personal signals; detailed tech/project facts stay in RAG."""
    candidates = []
    if analysis.get("technologies"):
        candidates.append(("work", "works on AI and software projects", 90))
    if analysis.get("projects") or analysis.get("project"):
        candidates.append(("work", "works on software projects", 90))
    if analysis.get("tags"):
        tags = {str(x).lower() for x in analysis.get("tags", [])}
        if tags.intersection({"ai", "artificial intelligence", "machine learning", "rag"}):
            candidates.append(("interest", "interested in AI and technology", 70))

    for category, value, priority in candidates:
        result = await db.execute(
            select(PersonalContextFact).where(
                PersonalContextFact.category == category,
                PersonalContextFact.value == value,
            )
        )
        fact = result.scalars().first()
        if not fact:
            fact = PersonalContextFact(category=category, value=value, sources=[str(knowledge_id)], priority=priority)
            db.add(fact)
        elif str(knowledge_id) not in (fact.sources or []):
            fact.sources = list(fact.sources or []) + [str(knowledge_id)]

    context = await get_or_create_personal_context(db)
    await rebuild_personal_context(db, context)


async def remove_knowledge_source(db: AsyncSession, knowledge_id: uuid.UUID) -> None:
    source = str(knowledge_id)
    result = await db.execute(select(PersonalContextFact))
    facts = list(result.scalars().all())
    for fact in facts:
        if source not in (fact.sources or []):
            continue
        remaining = [s for s in fact.sources if s != source]
        # Seed facts are permanent; derived facts disappear when their last source is deleted.
        if "seed" in remaining or remaining:
            fact.sources = remaining
        else:
            await db.delete(fact)
    context = await get_or_create_personal_context(db)
    await rebuild_personal_context(db, context)
