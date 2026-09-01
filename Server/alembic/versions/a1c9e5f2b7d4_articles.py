"""articles: promote the frontend-only Article prototype to real tables

Revision ID: a1c9e5f2b7d4
Revises: f4a7d2c9e6b1
Create Date: 2026-08-22 00:00:00.000000

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Adds article_folders and articles (World Anvil-style wiki entries, one table
covering every ArticleCategory from types/article.ts's ARTICLE_TEMPLATES, with
per-category fields stored in the field_values JSONB bag instead of a column
per template field). Also adds a loose linked_entity_type/linked_entity_id
pair on articles for an in-progress article<->NPC/Creature/Spell/Item bridging
feature - unused for now, no FK since the target table varies by type.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1c9e5f2b7d4'
down_revision: Union[str, Sequence[str], None] = 'f4a7d2c9e6b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "article_folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("world_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("article_folders.id", ondelete="CASCADE"), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("article_folders_world_id_idx", "article_folders", ["world_id"])
    op.create_index("article_folders_parent_id_idx", "article_folders", ["parent_id"])
    op.execute(
        "CREATE TRIGGER trg_article_folders_updated_at BEFORE UPDATE ON article_folders "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )

    op.create_table(
        "articles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("world_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("worlds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("folder_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("article_folders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("cover_image_src", sa.Text(), nullable=False, server_default=""),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("visibility", sa.Text(), nullable=False, server_default="gm"),
        sa.Column("field_values", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("body", sa.Text(), nullable=False, server_default=""),
        sa.Column("linked_entity_type", sa.Text(), nullable=True),
        sa.Column("linked_entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("articles_world_id_idx", "articles", ["world_id"])
    op.create_index("articles_folder_id_idx", "articles", ["folder_id"])
    op.execute(
        "CREATE TRIGGER trg_articles_updated_at BEFORE UPDATE ON articles "
        "FOR EACH ROW EXECUTE FUNCTION set_updated_at()"
    )


def downgrade() -> None:
    op.drop_index("articles_folder_id_idx", table_name="articles")
    op.drop_index("articles_world_id_idx", table_name="articles")
    op.drop_table("articles")

    op.drop_index("article_folders_parent_id_idx", table_name="article_folders")
    op.drop_index("article_folders_world_id_idx", table_name="article_folders")
    op.drop_table("article_folders")
