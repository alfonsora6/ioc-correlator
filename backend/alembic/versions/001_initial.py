"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(64), nullable=False),
        sa.Column("encrypted_key", sa.String(2048), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("tenant_id", "provider", name="uq_api_keys_tenant_provider"),
    )
    op.create_index("ix_api_keys_tenant_provider", "api_keys", ["tenant_id", "provider"])
    op.create_table(
        "analyses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ioc_value", sa.String(2048), nullable=False),
        sa.Column("ioc_type", sa.String(32), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("severity", sa.String(32), nullable=False),
        sa.Column("results_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_analyses_tenant_created", "analyses", ["tenant_id", "created_at"])
    op.create_index("ix_analyses_tenant_ioc", "analyses", ["tenant_id", "ioc_value"])
    op.create_table(
        "batch_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("total_iocs", sa.Integer(), server_default="0"),
        sa.Column("processed", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(32), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("source_text", sa.Text(), nullable=True),
    )
    op.create_table(
        "batch_job_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("batch_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("batch_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ioc_value", sa.String(2048), nullable=False),
        sa.Column("ioc_type", sa.String(32), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("severity", sa.String(32), nullable=False),
        sa.Column("results_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_table("batch_job_results")
    op.drop_table("batch_jobs")
    op.drop_index("ix_analyses_tenant_ioc", table_name="analyses")
    op.drop_index("ix_analyses_tenant_created", table_name="analyses")
    op.drop_table("analyses")
    op.drop_index("ix_api_keys_tenant_provider", table_name="api_keys")
    op.drop_table("api_keys")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.drop_table("tenants")
