from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/insights", tags=["Insights"])

@router.get("", response_model=List[Dict[str, Any]])
async def get_insights(
    current_user: User = Depends(get_current_user)
):
    # Returns static list of insights as a mock for Phase 1
    return [
        {
            "id": "1",
            "type": "summary",
            "message": "You have 12 notes related to Docker."
        },
        {
            "id": "2",
            "type": "relation",
            "message": "Your FastAPI notes are related to your Email Scheduler project."
        },
        {
            "id": "3",
            "type": "review",
            "message": "You haven't reviewed your Redis notes recently."
        }
    ]
