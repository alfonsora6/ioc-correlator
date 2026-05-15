import asyncio
from uuid import UUID

from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import BatchJob, BatchJobResult
from app.db.session import AsyncSessionLocal
from app.services.correlation import run_correlation
from app.services.ioc_detect import extract_iocs_from_text
from app.tasks.celery_app import celery_app


@celery_app.task(name="process_batch_job")
def process_batch_job(job_id: str) -> None:
    asyncio.run(_run_job(job_id))


async def _run_job(job_id: str) -> None:
    import redis.asyncio as redis_async

    settings = get_settings()
    redis_client = redis_async.from_url(settings.redis_url, decode_responses=True)
    try:
        async with AsyncSessionLocal() as db:
            q = await db.execute(select(BatchJob).where(BatchJob.id == UUID(job_id)))
            job = q.scalar_one_or_none()
            if not job or not job.source_text:
                return

            job.status = "running"
            job.processed = 0
            await db.commit()

            iocs = extract_iocs_from_text(job.source_text)
            seen: set[str] = set()
            ordered: list[str] = []
            for x in iocs:
                if x not in seen:
                    seen.add(x)
                    ordered.append(x)
            job.total_iocs = len(ordered)
            await db.commit()

            for idx, ioc in enumerate(ordered, start=1):
                try:
                    payload = await run_correlation(db, redis_client, job.tenant_id, ioc)
                    db.add(
                        BatchJobResult(
                            batch_job_id=job.id,
                            ioc_value=payload["ioc_value"],
                            ioc_type=payload["ioc_type"],
                            score=payload["score"],
                            severity=payload["severity"],
                            results_json={"sources": payload["sources"]},
                        )
                    )
                except Exception:
                    db.add(
                        BatchJobResult(
                            batch_job_id=job.id,
                            ioc_value=ioc,
                            ioc_type="unknown",
                            score=0,
                            severity="LOW",
                            results_json={"error": "failed"},
                        )
                    )
                job.processed = idx
                await db.commit()

            job.status = "done"
            await db.commit()
    except Exception:
        async with AsyncSessionLocal() as db:
            q = await db.execute(select(BatchJob).where(BatchJob.id == UUID(job_id)))
            job = q.scalar_one_or_none()
            if job:
                job.status = "error"
                await db.commit()
        raise
    finally:
        await redis_client.aclose()
