import asyncio
import csv
import io
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_redis
from app.core.security import decode_token_safe
from app.db.models import BatchJob, BatchJobResult, User
from app.db.session import get_db
from app.services.ioc_detect import extract_iocs_from_text
from app.tasks.batch_tasks import process_batch_job

router = APIRouter(prefix="/batch", tags=["batch"])

MAX_UPLOAD_BYTES = 2 * 1024 * 1024


@router.post("/upload")
async def upload_batch(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
):
    name = file.filename or "upload.txt"
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 2MB)")
    text = raw.decode("utf-8", errors="ignore")
    iocs = extract_iocs_from_text(text)
    if not iocs:
        raise HTTPException(status_code=400, detail="No IOCs found in file")

    job = BatchJob(
        tenant_id=user.tenant_id,
        user_id=user.id,
        filename=name,
        total_iocs=len(iocs),
        processed=0,
        status="pending",
        source_text=text,
    )
    db.add(job)
    await db.flush()
    process_batch_job.delay(str(job.id))
    return {"job_id": str(job.id), "total_iocs": len(iocs)}


@router.get("/{job_id}")
async def get_job(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    q = await db.execute(select(BatchJob).where(BatchJob.id == job_id, BatchJob.tenant_id == user.tenant_id))
    job = q.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": str(job.id),
        "filename": job.filename,
        "total_iocs": job.total_iocs,
        "processed": job.processed,
        "status": job.status,
        "created_at": job.created_at.isoformat() if job.created_at else "",
    }


@router.get("/{job_id}/results")
async def job_results(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    page: int = 1,
    page_size: int = 50,
):
    jq = await db.execute(select(BatchJob).where(BatchJob.id == job_id, BatchJob.tenant_id == user.tenant_id))
    if not jq.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")
    page = max(1, page)
    page_size = min(max(page_size, 1), 200)
    offset = (page - 1) * page_size
    rq = await db.execute(
        select(BatchJobResult)
        .where(BatchJobResult.batch_job_id == job_id)
        .offset(offset)
        .limit(page_size)
    )
    rows = rq.scalars().all()
    return [
        {
            "ioc_value": r.ioc_value,
            "ioc_type": r.ioc_type,
            "score": r.score,
            "severity": r.severity,
        }
        for r in rows
    ]


@router.get("/{job_id}/export.csv")
async def export_csv(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    jq = await db.execute(select(BatchJob).where(BatchJob.id == job_id, BatchJob.tenant_id == user.tenant_id))
    if not jq.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")
    rq = await db.execute(select(BatchJobResult).where(BatchJobResult.batch_job_id == job_id))
    rows = rq.scalars().all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ioc_value", "ioc_type", "score", "severity"])
    for r in rows:
        w.writerow([r.ioc_value, r.ioc_type, r.score, r.severity])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="batch-{job_id}.csv"'},
    )


@router.websocket("/ws/{job_id}")
async def batch_ws(websocket: WebSocket, job_id: UUID):
    await websocket.accept()
    token = websocket.query_params.get("token")
    payload = decode_token_safe(token) if token else None
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4401)
        return

    from app.db.session import AsyncSessionLocal

    user_id = UUID(str(payload["sub"]))
    try:
        while True:
            async with AsyncSessionLocal() as db:
                uq = await db.execute(select(User).where(User.id == user_id))
                user = uq.scalar_one_or_none()
                if not user:
                    await websocket.send_json({"error": "unauthorized"})
                    break
                jq = await db.execute(
                    select(BatchJob).where(BatchJob.id == job_id, BatchJob.tenant_id == user.tenant_id)
                )
                job = jq.scalar_one_or_none()
                if not job:
                    await websocket.send_json({"error": "not_found"})
                    break
                await websocket.send_json(
                    {
                        "processed": job.processed,
                        "total": job.total_iocs,
                        "status": job.status,
                    }
                )
                if job.status in ("done", "error"):
                    break
            await asyncio.sleep(0.7)
    except WebSocketDisconnect:
        return
