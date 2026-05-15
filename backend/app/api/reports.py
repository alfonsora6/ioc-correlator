import base64
import io
from datetime import UTC, datetime
from typing import Annotated

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from jinja2 import Template
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from weasyprint import HTML

from app.api.deps import get_current_user
from app.db.models import Analysis, Tenant, User
from app.db.session import get_db

router = APIRouter(prefix="/reports", tags=["reports"])


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _chart_png(severity_counts: dict[str, int]) -> str:
    labels = list(severity_counts.keys())
    vals = [severity_counts.get(k, 0) for k in labels]
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.bar(labels, vals, color=["#22c55e", "#eab308", "#f97316", "#ef4444"][: len(labels)])
    ax.set_title("Severity distribution")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


@router.get("/pdf")
async def export_pdf(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    date_from: datetime = Query(alias="from"),
    date_to: datetime = Query(alias="to"),
):
    if date_to < date_from:
        raise HTTPException(status_code=400, detail="Invalid date range")

    tq = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = tq.scalar_one()

    aq = await db.execute(
        select(Analysis)
        .where(
            Analysis.tenant_id == user.tenant_id,
            Analysis.created_at >= _as_utc(date_from),
            Analysis.created_at <= _as_utc(date_to),
        )
        .order_by(Analysis.created_at.desc())
        .limit(500)
    )
    rows = aq.scalars().all()

    sev_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for r in rows:
        if r.severity in sev_counts:
            sev_counts[r.severity] += 1

    img_b64 = _chart_png(sev_counts)

    tpl = Template(
        """
    <html>
      <head><meta charset="utf-8"/><style>
        body { font-family: DejaVu Sans, sans-serif; color: #111; }
        header { border-bottom: 2px solid #4c1d95; padding-bottom: 8px; margin-bottom: 16px; }
        footer { border-top: 1px solid #ccc; margin-top: 24px; font-size: 10px; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px; font-size: 11px; }
        th { background: #f3f4f6; }
        .CRITICAL { background: #fee2e2; }
        .HIGH { background: #ffedd5; }
        .MEDIUM { background: #fef9c3; }
        .LOW { background: #dcfce7; }
      </style></head>
      <body>
        <header>
          <h2>IOC Correlator — PDF Report</h2>
          <div><strong>Tenant:</strong> {{ tenant }}</div>
          <div><strong>Generated (UTC):</strong> {{ ts }}</div>
          <div><strong>User:</strong> {{ user_email }} ({{ user_name }})</div>
          <div><strong>Range:</strong> {{ df }} → {{ dt }}</div>
        </header>
        <img src="data:image/png;base64,{{ chart }}" style="max-width:100%;"/>
        <h3>Analyses (up to 500)</h3>
        <table>
          <thead><tr><th>Time (UTC)</th><th>IOC</th><th>Type</th><th>Score</th><th>Severity</th></tr></thead>
          <tbody>
          {% for r in rows %}
            <tr class="{{ r.severity }}">
              <td>{{ r.created_at }}</td>
              <td>{{ r.ioc_value }}</td>
              <td>{{ r.ioc_type }}</td>
              <td>{{ r.score }}</td>
              <td>{{ r.severity }}</td>
            </tr>
          {% endfor %}
          </tbody>
        </table>
        <footer>IOC Correlator — Logo placeholder — Confidential</footer>
      </body>
    </html>
    """
    )

    html = tpl.render(
        tenant=tenant.name,
        ts=datetime.now(UTC).isoformat(),
        user_email=user.email,
        user_name=user.full_name,
        df=date_from.isoformat(),
        dt=date_to.isoformat(),
        chart=img_b64,
        rows=[
            {
                "created_at": (r.created_at.astimezone(UTC).isoformat() if r.created_at else ""),
                "ioc_value": r.ioc_value,
                "ioc_type": r.ioc_type,
                "score": r.score,
                "severity": r.severity,
            }
            for r in rows
        ],
    )

    pdf_bytes = HTML(string=html).write_pdf()
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="ioc-report.pdf"'},
    )
