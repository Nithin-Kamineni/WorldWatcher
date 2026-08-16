import uuid
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

Category = Literal["monster", "npc"]
Relation = Literal["ally", "enemy", "neutral", "player"]
Importance = Literal[
    "boss", "npc", "side-character", "recurring", "important", "quest-giver", "minion", "summon", "monster"
]
ActionType = Literal["trait", "action", "bonus_action", "reaction", "legendary", "mythic", "lair", "other"]
SaveAbility = Literal["str", "dex", "con", "int", "wis", "cha"]


class CreatureActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    creature_id: uuid.UUID
    name: str
    action_type: str
    sort_order: int
    description: Optional[str] = None
    attack_bonus: Optional[int] = None
    reach: Optional[int] = None
    range_normal: Optional[int] = None
    range_long: Optional[int] = None
    damage_formula: Optional[str] = None
    damage_type: Optional[str] = None
    save_ability: Optional[str] = None
    save_dc: Optional[int] = None
    recharge: Optional[str] = None
    uses_text: Optional[str] = None
    area: Optional[Any] = None
    mechanics: Optional[Any] = None
    raw_data: Optional[Any] = None


class CreatureActionCreate(BaseModel):
    name: str
    action_type: ActionType
    sort_order: int = 0
    description: Optional[str] = None
    attack_bonus: Optional[int] = None
    reach: Optional[int] = None
    range_normal: Optional[int] = None
    range_long: Optional[int] = None
    damage_formula: Optional[str] = None
    damage_type: Optional[str] = None
    save_ability: Optional[SaveAbility] = None
    save_dc: Optional[int] = None
    recharge: Optional[str] = None
    uses_text: Optional[str] = None
    area: Optional[Any] = None
    mechanics: Optional[Any] = None
    raw_data: Optional[Any] = None


class CreatureActionUpdate(BaseModel):
    name: Optional[str] = None
    action_type: Optional[ActionType] = None
    sort_order: Optional[int] = None
    description: Optional[str] = None
    attack_bonus: Optional[int] = None
    reach: Optional[int] = None
    range_normal: Optional[int] = None
    range_long: Optional[int] = None
    damage_formula: Optional[str] = None
    damage_type: Optional[str] = None
    save_ability: Optional[SaveAbility] = None
    save_dc: Optional[int] = None
    recharge: Optional[str] = None
    uses_text: Optional[str] = None
    area: Optional[Any] = None
    mechanics: Optional[Any] = None
    raw_data: Optional[Any] = None


class CreatureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    category: str
    name: str
    slug: str
    edition: Optional[str] = None
    creature_type: Optional[str] = None
    creature_subtype: Optional[str] = None
    size: Optional[str] = None
    alignment: Optional[str] = None
    challenge_rating: Optional[float] = None
    challenge_rating_display: Optional[str] = None
    proficiency_bonus: Optional[int] = None
    armor_class: Optional[int] = None
    hit_points: Optional[int] = None
    hit_dice: Optional[str] = None
    strength: Optional[int] = None
    dexterity: Optional[int] = None
    constitution: Optional[int] = None
    intelligence: Optional[int] = None
    wisdom: Optional[int] = None
    charisma: Optional[int] = None
    skills: Optional[str] = None
    senses: Optional[str] = None
    passive_perception: Optional[int] = None
    languages: Optional[str] = None
    traits: Optional[str] = None
    description: Optional[str] = None
    relation: Optional[str] = None
    importance: Optional[str] = None
    profession: Optional[str] = None
    level: Optional[int] = None
    character_class: Optional[str] = None
    motivations: Optional[str] = None
    pitfalls: Optional[str] = None
    history: Optional[str] = None
    portrait_asset_id: Optional[uuid.UUID] = None
    token_asset_id: Optional[uuid.UUID] = None
    default_size: float
    current_size: float
    is_favorite: bool = False
    created_at: datetime
    updated_at: datetime


class CreatureDetail(CreatureRead):
    raw_data: Optional[Any] = None
    actions: list[CreatureActionRead] = []


class CreatureCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    category: Category
    name: str
    slug: str
    edition: Optional[str] = None
    creature_type: Optional[str] = None
    creature_subtype: Optional[str] = None
    size: Optional[str] = None
    alignment: Optional[str] = None
    challenge_rating: Optional[float] = None
    challenge_rating_display: Optional[str] = None
    proficiency_bonus: Optional[int] = None
    armor_class: Optional[int] = None
    hit_points: Optional[int] = None
    hit_dice: Optional[str] = None
    strength: Optional[int] = None
    dexterity: Optional[int] = None
    constitution: Optional[int] = None
    intelligence: Optional[int] = None
    wisdom: Optional[int] = None
    charisma: Optional[int] = None
    skills: Optional[str] = None
    senses: Optional[str] = None
    passive_perception: Optional[int] = None
    languages: Optional[str] = None
    traits: Optional[str] = None
    description: Optional[str] = None
    relation: Optional[Relation] = None
    importance: Optional[Importance] = None
    profession: Optional[str] = None
    level: Optional[int] = None
    character_class: Optional[str] = None
    motivations: Optional[str] = None
    pitfalls: Optional[str] = None
    history: Optional[str] = None
    portrait_asset_id: Optional[uuid.UUID] = None
    token_asset_id: Optional[uuid.UUID] = None
    default_size: float = 1
    current_size: float = 1
    is_favorite: bool = False
    raw_data: Optional[Any] = None


class CreatureUpdate(BaseModel):
    source_id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    category: Optional[Category] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    edition: Optional[str] = None
    creature_type: Optional[str] = None
    creature_subtype: Optional[str] = None
    size: Optional[str] = None
    alignment: Optional[str] = None
    challenge_rating: Optional[float] = None
    challenge_rating_display: Optional[str] = None
    proficiency_bonus: Optional[int] = None
    armor_class: Optional[int] = None
    hit_points: Optional[int] = None
    hit_dice: Optional[str] = None
    strength: Optional[int] = None
    dexterity: Optional[int] = None
    constitution: Optional[int] = None
    intelligence: Optional[int] = None
    wisdom: Optional[int] = None
    charisma: Optional[int] = None
    skills: Optional[str] = None
    senses: Optional[str] = None
    passive_perception: Optional[int] = None
    languages: Optional[str] = None
    traits: Optional[str] = None
    description: Optional[str] = None
    relation: Optional[Relation] = None
    importance: Optional[Importance] = None
    profession: Optional[str] = None
    level: Optional[int] = None
    character_class: Optional[str] = None
    motivations: Optional[str] = None
    pitfalls: Optional[str] = None
    history: Optional[str] = None
    portrait_asset_id: Optional[uuid.UUID] = None
    token_asset_id: Optional[uuid.UUID] = None
    default_size: Optional[float] = None
    current_size: Optional[float] = None
    is_favorite: Optional[bool] = None
    raw_data: Optional[Any] = None
