"""item_usage table - server-side signals for the Items window's usefulness ranking

Checklist I-P9. The Play page's five Items sub-windows rank by recorded usefulness rather than
alphabetically, but the counters lived only in the DM's browser, so "most useful" reset on a new
machine and nothing server-side could ever use them. This is the real table.

HAND-TRIMMED. `alembic revision --autogenerate` also emitted 131 drop_index/drop_constraint
statements for indexes that exist in the database but are not declared on the ORM models (the
trigram and FK indexes created by Database/Maintainance/sql/001_schema.sql). Those are real,
wanted indexes - autogenerate simply cannot see them from the models - so keeping them would
have silently dropped a large part of the search performance work. Only the new table remains.

Revision ID: a3d565c82927
Revises: a8e2d5c1f9b3
Create Date: 2026-09-04 05:33:01.479670
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3d565c82927"
down_revision: Union[str, Sequence[str], None] = "a8e2d5c1f9b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "item_usage",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("campaign_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("item_id", sa.Text(), nullable=False),
        sa.Column("rolls", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("opens", sa.BigInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        # Named, because the upsert in app/api/routers/item_usage.py targets this constraint by
        # name in ON CONFLICT - that is what lets two Play windows record the same open
        # concurrently without either clobbering the other's count.
        sa.UniqueConstraint("campaign_id", "kind", "item_id", name="uq_item_usage_campaign_kind_item"),
    )
    # The only query shape there is: "every row for this campaign", loaded once and ranked in
    # memory.
    op.create_index("item_usage_campaign_id_idx", "item_usage", ["campaign_id"])


def downgrade() -> None:
    op.drop_index("item_usage_campaign_id_idx", table_name="item_usage")
    op.drop_table("item_usage")
