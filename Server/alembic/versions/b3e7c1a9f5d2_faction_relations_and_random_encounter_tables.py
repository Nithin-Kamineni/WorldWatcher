"""faction diplomacy merge + random encounter tables

Revision ID: b3e7c1a9f5d2
Revises: 9f1d6c3a7e42
Create Date: 2026-08-15 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

- factions: drops the freeform `relationships` tag list (superseded by the new
  faction_relations table below) and gains the diplomacy-graph fields that used
  to live only in the browser-localStorage DiplomaticFaction prototype
  (governance, power, power_label, location_summary, military, naval, economy,
  reputation) - the Factions table and the Factions diplomacy graph are now
  backed by the same rows.
- faction_relations: one row per unordered faction pair (faction_a_id <
  faction_b_id, enforced by CHECK + UNIQUE), so a relation edited from either
  faction's side is the same data on both sides. Cascades on faction delete.
- random_encounter_tables: promotes the DM's custom "roll a die across a group
  of encounters" tool from useRandomEncounterTableStore's localStorage-only
  persistence to a real table (distinct from encounters.tables/resolution_type,
  which is importer-owned reference data for 5etools' own random tables).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b3e7c1a9f5d2'
down_revision: Union[str, Sequence[str], None] = '9f1d6c3a7e42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- factions ----
    op.drop_column("factions", "relationships")
    op.add_column("factions", sa.Column("governance", sa.Text(), nullable=True))
    op.add_column("factions", sa.Column("power", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("factions", sa.Column("power_label", sa.Text(), nullable=True))
    op.add_column("factions", sa.Column("location_summary", sa.Text(), nullable=True))
    op.add_column("factions", sa.Column("military", sa.Integer(), nullable=False, server_default="30"))
    op.add_column("factions", sa.Column("naval", sa.Integer(), nullable=False, server_default="30"))
    op.add_column("factions", sa.Column("economy", sa.Integer(), nullable=False, server_default="30"))
    op.add_column("factions", sa.Column("reputation", sa.Integer(), nullable=False, server_default="30"))

    # ---- faction_relations ----
    op.create_table(
        "faction_relations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("faction_a_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("factions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("faction_b_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("factions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relation_type", sa.Text(), nullable=False, server_default="neutral"),
        sa.Column("strength", sa.Integer(), nullable=False, server_default="40"),
        sa.Column("treaties", postgresql.JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "relation_type IN ('ally','trade','peace','neutral','war','enemy')",
            name="faction_relations_relation_type_check",
        ),
        sa.CheckConstraint("faction_a_id < faction_b_id", name="faction_relations_pair_order_check"),
        sa.UniqueConstraint("faction_a_id", "faction_b_id", name="faction_relations_pair_uidx"),
    )
    op.create_index("faction_relations_campaign_id_idx", "faction_relations", ["campaign_id"])
    op.create_index("faction_relations_faction_b_id_idx", "faction_relations", ["faction_b_id"])
    op.execute(
        "CREATE TRIGGER trg_faction_relations_updated_at BEFORE UPDATE ON faction_relations "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )

    # ---- random_encounter_tables ----
    op.create_table(
        "random_encounter_tables",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("campaigns.id"), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("die_expression", sa.Text(), nullable=False, server_default="1d8"),
        sa.Column("entries", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("random_encounter_tables_campaign_id_idx", "random_encounter_tables", ["campaign_id"])
    op.execute(
        "CREATE TRIGGER trg_random_encounter_tables_updated_at BEFORE UPDATE ON random_encounter_tables "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )


def downgrade() -> None:
    op.drop_index("random_encounter_tables_campaign_id_idx", table_name="random_encounter_tables")
    op.drop_table("random_encounter_tables")

    op.drop_index("faction_relations_faction_b_id_idx", table_name="faction_relations")
    op.drop_index("faction_relations_campaign_id_idx", table_name="faction_relations")
    op.drop_table("faction_relations")

    op.drop_column("factions", "reputation")
    op.drop_column("factions", "economy")
    op.drop_column("factions", "naval")
    op.drop_column("factions", "military")
    op.drop_column("factions", "location_summary")
    op.drop_column("factions", "power_label")
    op.drop_column("factions", "power")
    op.drop_column("factions", "governance")
    op.add_column("factions", sa.Column("relationships", postgresql.JSONB(), nullable=True))
