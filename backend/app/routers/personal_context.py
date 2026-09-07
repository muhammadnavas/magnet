from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.routers.auth import get_current_user
from app.schemas.auth import UserOut as User
from app.services.personal_context import get_or_create_personal_context

router = APIRouter(prefix="/personal-context", tags=["Personal Context"])

@router.get("")
async def get_context(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    context = await get_or_create_personal_context(db)
    await db.commit()
    return {"context": context.context, "version": context.version, "updated_at": context.updated_at}
