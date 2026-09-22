"""How useful each browsable item has proven to be, per campaign.

The Play page's Items window ranks every sub-window (random tables, encounters, stat blocks,
places, factions) by relevance blended with recorded usefulness rather than alphabetically -
alphabetical order buries the weather table a DM rolls every in-game morning under whatever
happens to start with an "A". Those signals lived only in the DM's browser (localStorage), so
"most useful" reset on a new machine and nothing server-side could use them. This is the real
table (checklist I-P9).

One row per (campaign, kind, item). `item_id` is deliberately NOT a foreign key: the five kinds
point at five different tables (random_tables, encounters, creatures/spells/items, articles,
factions), and a usage counter is not a relationship - it is an observation about an id. A row
whose item has since been deleted is harmless (it ranks nothing, because nothing looks it up)
and is cheaper to leave than to cascade five ways.
"""
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class ItemUsage(Base):
    __tablename__ = "item_usage"
    __table_args__ = (
        UniqueConstraint("campaign_id", "kind", "item_id", name="uq_item_usage_campaign_kind_item"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    # One of the Items window's sub-window kinds: random-tables | encounters | stats | places |
    # factions. Text rather than an enum so adding a sixth sub-window is a client change only.
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    # The client's own id for the row - a bare uuid for most kinds, a composite
    # "creature:<uuid>" / "spell:<uuid>" / "item:<uuid>" for the Stats sub-window, which ranks
    # three entity types in one list. Text, so both shapes fit without the server needing to
    # care which kind it is looking at.
    item_id: Mapped[str] = mapped_column(Text, nullable=False)

    # Times the DM put it to work - rolled the table, ran the encounter, read the stat block
    # open. The strongest "this is useful to me" signal there is.
    rolls: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))
    # Times it was merely opened into the pane without being used.
    opens: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
