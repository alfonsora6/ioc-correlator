from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_redis
from app.db.models import Analysis, User
from app.db.session import get_db
from app.schemas.analysis import AnalysisOut, AnalyzeRequest
from app.services.correlation import run_correlation

router = APIRouter(prefix="/analyses", tags=["analyses"])


@router.post("")
async def analyze_ioc(
    body: AnalyzeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    redis=Depends(get_redis),
):
    try:
        payload = await run_correlation(db, redis, user.tenant_id, body.ioc)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    row = Analysis(
        tenant_id=user.tenant_id,
        user_id=user.id,
        ioc_value=payload["ioc_value"],
        ioc_type=payload["ioc_type"],
        score=payload["score"],
        severity=payload["severity"],
        results_json={"sources": payload["sources"]},
    )
    db.add(row)
    await db.flush()
    return {
        "id": str(row.id),
        "ioc_value": row.ioc_value,
        "ioc_type": row.ioc_type,
        "score": row.score,
        "severity": row.severity,
        "sources": payload["sources"],
    }


@router.get("/history", response_model=list[AnalysisOut])
async def history(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    limit: int = 500,
):
    limit = min(max(limit, 1), 500)
    q = await db.execute(
        select(Analysis)
        .where(Analysis.tenant_id == user.tenant_id)
        .order_by(desc(Analysis.created_at))
        .limit(limit)
    )
    rows = q.scalars().all()
    return [
        AnalysisOut(
            id=str(r.id),
            ioc_value=r.ioc_value,
            ioc_type=r.ioc_type,
            score=r.score,
            severity=r.severity,
            results_json=r.results_json,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in rows
    ]
