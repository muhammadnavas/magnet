from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/github", tags=["GitHub Integration"])

@router.post("/connect", status_code=status.HTTP_200_OK)
async def connect_github(
    code: str,
    current_user: User = Depends(get_current_user)
):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="GitHub authentication flow and OAuth callbacks will be wired in Phase 5."
    )

@router.get("/repos", response_model=List[Dict[str, Any]])
async def list_github_repositories(
    current_user: User = Depends(get_current_user)
):
    return []

@router.post("/import", status_code=status.HTTP_202_ACCEPTED)
async def import_github_content(
    repo_name: str,
    files: List[str],
    current_user: User = Depends(get_current_user)
):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="GitHub source code importing pipelines will be fully implemented in Phase 5."
    )
