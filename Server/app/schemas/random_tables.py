import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    slug: str
    name: str
    parent_id: Optional[uuid.UUID] = None
    is_system: bool
    icon: Optional[str] = None
    sort_order: int
    created_at: datetime


class CategoryCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    slug: str
    name: str
    parent_id: Optional[uuid.UUID] = None
    icon: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None


class CategoryNode(CategoryRead):
    """A CategoryRead plus its children, for the tree endpoint."""

    children: list["CategoryNode"] = []


class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    namespace: str
    value: str
    label: str
    is_system: bool


class TagCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    namespace: str
    value: str
    label: str


class TableFormatRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    slug: str
    name: str
    description: Optional[str] = None
    tier: str
    is_system: bool


class TableFormatCreate(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    tier: str = "core"


class TableFormatUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tier: Optional[str] = None


# ---- random_tables / table_columns / table_entries ----


class TableEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    column_id: uuid.UUID
    min: Optional[int] = None
    max: Optional[int] = None
    secondary_min: Optional[int] = None
    secondary_max: Optional[int] = None
    weight: Optional[int] = None
    kind: str = "text"
    text: Optional[str] = None
    encounter_id: Optional[uuid.UUID] = None
    target_table_id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    npc_id: Optional[uuid.UUID] = None
    item_id: Optional[uuid.UUID] = None
    bundle: Optional[Any] = None
    notes: Optional[str] = None
    sort_order: int = 0
    tag_ids: list[uuid.UUID] = []
    ref_hydrated: Optional[dict[str, Any]] = None


class TableEntryWrite(BaseModel):
    """Used inline within TableColumnWrite when replacing a table's whole
    structure (Task 5.2.3 validates the full column+entries set together)."""

    id: Optional[uuid.UUID] = None
    min: Optional[int] = None
    max: Optional[int] = None
    secondary_min: Optional[int] = None
    secondary_max: Optional[int] = None
    weight: Optional[int] = None
    kind: str = "text"
    text: Optional[str] = None
    encounter_id: Optional[uuid.UUID] = None
    target_table_id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    npc_id: Optional[uuid.UUID] = None
    item_id: Optional[uuid.UUID] = None
    bundle: Optional[Any] = None
    notes: Optional[str] = None
    sort_order: int = 0
    tag_ids: list[uuid.UUID] = []


class TableColumnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    table_id: uuid.UUID
    name: str
    die_count: int
    die_sides: int
    die_modifier: int
    sort_order: int
    entries: list[TableEntryRead] = []


class TableColumnWrite(BaseModel):
    id: Optional[uuid.UUID] = None
    name: str
    die_count: int = 1
    die_sides: int = 20
    die_modifier: int = 0
    sort_order: int = 0
    entries: list[TableEntryWrite] = []


class RandomTableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    format_id: uuid.UUID
    trigger_situation: Optional[str] = None
    image_url: Optional[str] = None
    combine_template: Optional[str] = None
    source_book: Optional[str] = None
    format_config: Optional[Any] = None
    is_system: bool
    created_at: datetime
    updated_at: datetime
    tag_ids: list[uuid.UUID] = []


class RandomTableDetail(RandomTableRead):
    columns: list[TableColumnRead] = []


class RandomTableCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    name: str
    description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    format_id: uuid.UUID
    trigger_situation: Optional[str] = None
    image_url: Optional[str] = None
    combine_template: Optional[str] = None
    source_book: Optional[str] = None
    format_config: Optional[Any] = None
    tag_ids: list[uuid.UUID] = []
    columns: list[TableColumnWrite] = []


class RandomTableUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    format_id: Optional[uuid.UUID] = None
    trigger_situation: Optional[str] = None
    image_url: Optional[str] = None
    combine_template: Optional[str] = None
    source_book: Optional[str] = None
    format_config: Optional[Any] = None


class TableStructureWrite(BaseModel):
    """PUT body for /random-tables/{id}/structure - replaces every column
    and entry wholesale (Task 5.2.3's validation runs over this whole set)."""

    columns: list[TableColumnWrite]


class TagIdsWrite(BaseModel):
    tag_ids: list[uuid.UUID]


class RollRequest(BaseModel):
    """Optional per-roll parameters the advanced formats need (Task 4.3)."""

    modifier: int = 0  # check_table
    counter: int = 0  # clock
    likelihood: float = 0.5  # oracle, 0..1
    chance_percent: Optional[float] = None  # chance_gate override
    drawn_entry_ids: list[uuid.UUID] = []  # deck/countdown_deck
    sequence_length: Optional[int] = None  # sequence
    depth: int = 0  # recursion guard for cascading/table_ref, server-internal
    state: dict[str, Any] = {}  # branching rules may inspect arbitrary caller state
    # Optional entry-level constraints. Values inside one namespace are ORed;
    # different namespaces are ANDed. A namespace is ignored for a column when
    # that column has no entries tagged in it, so a name-style constraint does
    # not accidentally empty an occupation table.
    filter_tag_ids: list[uuid.UUID] = []


class RolledDieOut(BaseModel):
    sides: int
    result: int


class RollResultItem(BaseModel):
    column_name: Optional[str] = None
    dice: list[RolledDieOut] = []
    total: int = 0
    entry_id: Optional[uuid.UUID] = None
    tag_ids: list[uuid.UUID] = []
    kind: str = "text"
    text: Optional[str] = None
    resolved_text: Optional[str] = None
    ref_id: Optional[uuid.UUID] = None
    ref_hydrated: Optional[dict] = None
    extra: dict[str, Any] = {}
    nested: Optional["RollResult"] = None  # populated for cascading/table_ref


class RollResult(BaseModel):
    table_id: uuid.UUID
    table_name: str
    format_slug: str
    items: list[RollResultItem]
    combined_text: Optional[str] = None
    gate_passed: Optional[bool] = None  # chance_gate only


# ---- generators ----


class GeneratorParameter(BaseModel):
    key: str
    label: str
    type: str = "tag"  # "tag" | "text"
    allowed_tags: list[str] = []
    required: bool = False
    default: Optional[str] = None


class GeneratorComponentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    generator_id: uuid.UUID
    table_id: uuid.UUID
    output_slot: str
    filter_param_key: Optional[str] = None
    roll_count: int = 1
    optional: bool = False
    sort_order: int = 0


class GeneratorComponentWrite(BaseModel):
    id: Optional[uuid.UUID] = None
    table_id: uuid.UUID
    output_slot: str
    filter_param_key: Optional[str] = None
    roll_count: int = 1
    optional: bool = False
    sort_order: int = 0


class GeneratorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: Optional[uuid.UUID] = None
    slug: str
    name: str
    category_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    combine_template: str
    parameters: list[GeneratorParameter] = []
    is_system: bool
    created_at: datetime
    updated_at: datetime
    tag_ids: list[uuid.UUID] = []


class GeneratorDetail(GeneratorRead):
    components: list[GeneratorComponentRead] = []


class GeneratorCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    slug: str
    name: str
    category_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    combine_template: str
    parameters: list[GeneratorParameter] = []
    tag_ids: list[uuid.UUID] = []
    components: list[GeneratorComponentWrite] = []


class GeneratorUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    combine_template: Optional[str] = None
    parameters: Optional[list[GeneratorParameter]] = None


class GeneratorComponentsWrite(BaseModel):
    components: list[GeneratorComponentWrite]


class GeneratorRollRequest(BaseModel):
    params: dict[str, str] = {}


class GeneratorRollSlotResult(BaseModel):
    slot: str
    table_id: uuid.UUID
    table_name: str
    result: Optional[RollResultItem] = None
    skipped: bool = False


class GeneratorRollResult(BaseModel):
    generator_id: uuid.UUID
    slots: list[GeneratorRollSlotResult]
    combined_text: str


CategoryNode.model_rebuild()
RollResultItem.model_rebuild()
RollResult.model_rebuild()
