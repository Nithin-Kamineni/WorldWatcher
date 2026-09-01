"""worlds: World -> Campaign scope split

Revision ID: f4a7d2c9e6b1
Revises: e2b6f4a0d8c7
Create Date: 2026-08-22 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Adds the World entity from the UI redesign (Prompt Images/WorldWatcher UI
redisgn.md section 2): a World is the setting, a Campaign is a play-through
inside it. The app was campaign-first until now, so this migration backfills
one World per existing Campaign (same name/description/image/timestamps),
matching the doc's own migration note, then makes campaigns.world_id NOT NULL.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f4a7d2c9e6b1'
down_revision: Union[str, Sequence[str], None] = 'e2b6f4a0d8c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "worlds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_asset_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assets.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute(
        "CREATE TRIGGER trg_worlds_updated_at BEFORE UPDATE ON worlds "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )

    op.add_column("campaigns", sa.Column("world_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("worlds.id"), nullable=True))

    # Backfill: one World per existing Campaign, carrying over name/description/image/timestamps.
    op.execute(
        """
        DO $$
        DECLARE
          camp RECORD;
          new_world_id uuid;
        BEGIN
          FOR camp IN SELECT id, name, description, image_asset_id, created_at, updated_at FROM campaigns LOOP
            INSERT INTO worlds (id, name, description, image_asset_id, created_at, updated_at)
            VALUES (gen_random_uuid(), camp.name, camp.description, camp.image_asset_id, camp.created_at, camp.updated_at)
            RETURNING id INTO new_world_id;

            UPDATE campaigns SET world_id = new_world_id WHERE id = camp.id;
          END LOOP;
        END $$;
        """
    )

    op.alter_column("campaigns", "world_id", nullable=False)
    op.create_index("campaigns_world_id_idx", "campaigns", ["world_id"])


def downgrade() -> None:
    op.drop_index("campaigns_world_id_idx", table_name="campaigns")
    op.drop_column("campaigns", "world_id")
    op.drop_table("worlds")
