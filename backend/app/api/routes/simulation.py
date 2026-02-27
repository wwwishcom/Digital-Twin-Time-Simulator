from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.life_score import WhatIfRequest, WhatIfResult
from app.services.simulation_service import run_what_if

router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.post("/what-if", response_model=WhatIfResult)
def what_if(
    payload: WhatIfRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return run_what_if(db, current_user.id, payload)
