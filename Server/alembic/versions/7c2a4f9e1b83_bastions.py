"""bastions: bastion_facilities + bastions + bastion_facility_instances

Revision ID: 7c2a4f9e1b83
Revises: 484eefd2a5b3
Create Date: 2026-08-15 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Bugs.txt #5: adds the D&D 2024 Bastion system - a read-only reference catalog
of facility types (bastion_facilities, importer-owned like spells/items) plus
a per-campaign tracker (bastions, one row per PC's stronghold) and a join
table recording which facilities each bastion has actually built
(bastion_facility_instances).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7c2a4f9e1b83'
down_revision: Union[str, Sequence[str], None] = '484eefd2a5b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bastion_facilities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sources.id"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("facility_type", sa.Text(), nullable=False, server_default="basic"),
        sa.Column("space", postgresql.JSONB(), nullable=True),
        sa.Column("prerequisite_level", sa.Integer(), nullable=True),
        sa.Column("hirelings", postgresql.JSONB(), nullable=True),
        sa.Column("orders", postgresql.JSONB(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("page", sa.Integer(), nullable=True),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("facility_type IN ('basic','special')", name="bastion_facilities_facility_type_check"),
    )
    op.create_index(
        "bastion_facilities_slug_source_uidx", "bastion_facilities", ["slug", "source_id"],
        unique=True, postgresql_where=sa.text("source_id IS NOT NULL"),
    )
    op.execute(
        "CREATE TRIGGER trg_bastion_facilities_updated_at BEFORE UPDATE ON bastion_facilities "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )

    op.create_table(
        "bastions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("character_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("characters.id"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("treasury", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("raw_data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("bastions_campaign_id_idx", "bastions", ["campaign_id"])
    op.create_index("bastions_character_id_idx", "bastions", ["character_id"])
    op.execute(
        "CREATE TRIGGER trg_bastions_updated_at BEFORE UPDATE ON bastions "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )

    op.create_table(
        "bastion_facility_instances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("bastion_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bastions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("facility_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bastion_facilities.id"), nullable=True),
        sa.Column("custom_name", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="built"),
        sa.Column("defenders_assigned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("pending_order", postgresql.JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "status IN ('under_construction','built','decommissioned')",
            name="bastion_facility_instances_status_check",
        ),
    )
    op.create_index("bastion_facility_instances_bastion_id_idx", "bastion_facility_instances", ["bastion_id"])
    op.create_index("bastion_facility_instances_facility_id_idx", "bastion_facility_instances", ["facility_id"])
    op.execute(
        "CREATE TRIGGER trg_bastion_facility_instances_updated_at BEFORE UPDATE ON bastion_facility_instances "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )


def downgrade() -> None:
    op.drop_index("bastion_facility_instances_facility_id_idx", table_name="bastion_facility_instances")
    op.drop_index("bastion_facility_instances_bastion_id_idx", table_name="bastion_facility_instances")
    op.drop_table("bastion_facility_instances")

    op.drop_index("bastions_character_id_idx", table_name="bastions")
    op.drop_index("bastions_campaign_id_idx", table_name="bastions")
    op.drop_table("bastions")

    op.drop_index("bastion_facilities_slug_source_uidx", table_name="bastion_facilities")
    op.drop_table("bastion_facilities")
