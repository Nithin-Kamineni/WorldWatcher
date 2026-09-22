"""Three checklist items in one schema step (Part B):

  11.1  encounters.rewards was a JSONB blob whose kind='item' rows named a
        magic item in free text - the "reference, never duplicate" rule
        broken in the one place the checklist called out. The rows move to a
        real `encounter_rewards` join table with item_id FK'd to items.id,
        keeping only the encounter-specific metadata (quantity, description)
        on the row. The JSONB column is dropped so there is exactly one
        source of truth.

  11.2  encounters.generator_id - the missing half of "tables/generators must
        be referenceable FROM encounters". wandering_table_id already covered
        random_tables; this covers generators.

  B12   The old random-table subsystems (situational_tables,
        random_encounter_tables) were replaced by the unified random_tables
        system and their client code is gone. Drop the tables along with the
        models/routers removed in the same change.

Revision ID: a8e2d5c1f9b3
Revises: 7e3c5a1d9f42
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a8e2d5c1f9b3"
down_revision: Union[str, Sequence[str], None] = "7e3c5a1d9f42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- 11.1: rewards JSONB -> encounter_rewards rows ---------------------
    op.create_table(
        "encounter_rewards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "encounter_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("encounters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.Text(), nullable=False, server_default="other"),
        # The FK that makes kind='item' a reference rather than a restatement. Nullable
        # because the other kinds (currency, information, favor, experience) have no item
        # to point at, and because a DM can name an item the compendium doesn't have yet.
        sa.Column("item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("items.id"), nullable=True),
        # Still free text, but now only for what the FK cannot carry: "and a note pinned to
        # the hilt". For kind='item' with item_id set, the item's own name is authoritative.
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_encounter_rewards_encounter_id", "encounter_rewards", ["encounter_id"])
    op.create_index("ix_encounter_rewards_item_id", "encounter_rewards", ["item_id"])

    # Backfill from the JSONB array, preserving order. kind='item' rows get their item_id
    # resolved by an exact case-insensitive name match against items - anything that doesn't
    # match keeps its description and simply has no FK yet, so nothing is lost.
    op.execute(
        """
        INSERT INTO encounter_rewards (encounter_id, kind, item_id, description, quantity, sort_order)
        SELECT
            e.id,
            COALESCE(r.value ->> 'kind', 'other'),
            i.id,
            COALESCE(r.value ->> 'description', ''),
            GREATEST(COALESCE((r.value ->> 'quantity')::int, 1), 1),
            r.ordinality - 1
        FROM encounters e
        CROSS JOIN LATERAL jsonb_array_elements(e.rewards) WITH ORDINALITY AS r(value, ordinality)
        LEFT JOIN items i
               ON COALESCE(r.value ->> 'kind', 'other') = 'item'
              AND lower(i.name) = lower(trim(COALESCE(r.value ->> 'description', '')))
        WHERE e.rewards IS NOT NULL AND jsonb_typeof(e.rewards) = 'array'
        """
    )
    op.drop_column("encounters", "rewards")

    # --- 11.2: encounters -> generators ------------------------------------
    op.add_column(
        "encounters",
        sa.Column("generator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("generators.id"), nullable=True),
    )

    # --- B12: drop the replaced random-table subsystems ---------------------
    op.execute("DROP TABLE IF EXISTS situational_tables CASCADE")
    op.execute("DROP TABLE IF EXISTS random_encounter_tables CASCADE")


def downgrade() -> None:
    op.drop_column("encounters", "generator_id")

    op.add_column("encounters", sa.Column("rewards", postgresql.JSONB(), nullable=True))
    op.execute(
        """
        UPDATE encounters e
        SET rewards = sub.rewards
        FROM (
            SELECT r.encounter_id,
                   jsonb_agg(
                       jsonb_build_object(
                           'kind', r.kind,
                           'description', CASE WHEN i.name IS NOT NULL THEN i.name ELSE r.description END,
                           'quantity', r.quantity
                       )
                       ORDER BY r.sort_order
                   ) AS rewards
            FROM encounter_rewards r
            LEFT JOIN items i ON i.id = r.item_id
            GROUP BY r.encounter_id
        ) sub
        WHERE sub.encounter_id = e.id
        """
    )
    op.drop_index("ix_encounter_rewards_item_id", table_name="encounter_rewards")
    op.drop_index("ix_encounter_rewards_encounter_id", table_name="encounter_rewards")
    op.drop_table("encounter_rewards")

    # situational_tables / random_encounter_tables are NOT recreated: their content was
    # migrated into random_tables and their code is gone, so an empty shell would be
    # misleading rather than useful.
