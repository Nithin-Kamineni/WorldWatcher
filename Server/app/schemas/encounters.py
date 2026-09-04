import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class EncounterCreatureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    encounter_id: uuid.UUID
    creature_id: Optional[uuid.UUID] = None
    custom_name: Optional[str] = None
    custom_image_asset_id: Optional[uuid.UUID] = None
    quantity: int
    size_override: Optional[float] = None
    sort_order: int
    role: Optional[str] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None
    quantity_formula: Optional[str] = None
    # Denormalized from a join against creatures at read time (not stored columns) so the
    # client can show a real name/image/CR without maintaining its own campaign-scoped
    # creature lookup (which missed global-library creatures - see Bugs.txt roster fix).
    creature_name: Optional[str] = None
    creature_type: Optional[str] = None
    creature_cr: Optional[str] = None
    token_asset_id: Optional[uuid.UUID] = None
    portrait_asset_id: Optional[uuid.UUID] = None


class EncounterCreatureCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    creature_id: Optional[uuid.UUID] = None
    custom_name: Optional[str] = None
    custom_image_asset_id: Optional[uuid.UUID] = None
    quantity: int = 1
    size_override: Optional[float] = None
    sort_order: int = 0
    role: Optional[str] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None


class EncounterCreatureUpdate(BaseModel):
    creature_id: Optional[uuid.UUID] = None
    custom_name: Optional[str] = None
    custom_image_asset_id: Optional[uuid.UUID] = None
    quantity: Optional[int] = None
    size_override: Optional[float] = None
    sort_order: Optional[int] = None
    role: Optional[str] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None


class EncounterNpcRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    encounter_id: uuid.UUID
    npc_id: uuid.UUID
    attitude: Optional[str] = None
    agenda: Optional[str] = None
    secret: Optional[str] = None
    leverage: Optional[str] = None
    rp_cues: Optional[Any] = None
    sort_order: int = 0
    # Denormalized from a join against creatures at read time, same rationale as
    # EncounterCreatureRead above.
    npc_name: Optional[str] = None
    token_asset_id: Optional[uuid.UUID] = None
    portrait_asset_id: Optional[uuid.UUID] = None


class EncounterNpcCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    npc_id: uuid.UUID
    attitude: Optional[str] = None
    agenda: Optional[str] = None
    secret: Optional[str] = None
    leverage: Optional[str] = None
    rp_cues: Optional[Any] = None
    sort_order: int = 0


class EncounterNpcUpdate(BaseModel):
    npc_id: Optional[uuid.UUID] = None
    attitude: Optional[str] = None
    agenda: Optional[str] = None
    secret: Optional[str] = None
    leverage: Optional[str] = None
    rp_cues: Optional[Any] = None
    sort_order: Optional[int] = None


class ReinforcementPlan(BaseModel):
    mode: str = "none"
    trigger: str = ""
    round: Optional[int] = None
    table_id: Optional[uuid.UUID] = None


class EncounterCombatBlockWrite(BaseModel):
    shape: Optional[str] = None
    victory_condition: Optional[str] = None
    awareness: Optional[str] = None
    start_range: Optional[str] = None
    lighting: Optional[str] = None
    terrain_type: Optional[str] = None
    terrain_features: list[str] = []
    morale: Optional[str] = None
    reinforcements: Optional[ReinforcementPlan] = None
    dynamic_events: list[Any] = []
    difficulty_band: Optional[str] = None
    computed_xp: Optional[int] = None
    has_lair_or_legendary: bool = False
    aftermath: list[str] = []
    scaling_notes: Optional[str] = None
    map_id: Optional[uuid.UUID] = None
    transition_encounter_id: Optional[uuid.UUID] = None


class EncounterCombatBlockRead(EncounterCombatBlockWrite):
    model_config = ConfigDict(from_attributes=True)
    encounter_id: uuid.UUID


class EncounterSocialBlockWrite(BaseModel):
    shape: Optional[str] = None
    venue: Optional[str] = None
    tone: Optional[str] = None
    stakes: Optional[str] = None
    player_levers: list[str] = []
    key_checks: list[Any] = []
    outcome_tiers: Optional[Any] = None
    social_clock: Optional[Any] = None
    gated_info: list[Any] = []
    complications: list[str] = []
    escalation: Optional[str] = None
    transition_encounter_id: Optional[uuid.UUID] = None


class EncounterSocialBlockRead(EncounterSocialBlockWrite):
    model_config = ConfigDict(from_attributes=True)
    encounter_id: uuid.UUID


class TrapDetails(BaseModel):
    name: str = ""
    trigger: str = ""
    detect_dc: Optional[int] = None
    disable_dc: Optional[int] = None
    effect: str = ""
    damage_formula: str = ""
    damage_type: Optional[str] = None
    condition_ids: list[uuid.UUID] = []


class HazardDetails(BaseModel):
    name: str = ""
    save_ability: Optional[str] = None
    save_dc: Optional[int] = None
    effect: str = ""
    damage_formula: str = ""
    damage_type: Optional[str] = None
    condition_ids: list[uuid.UUID] = []


class SkillChallengeDetails(BaseModel):
    goal: str = ""
    successes_required: int = 3
    failures_allowed: int = 3
    skills: list[str] = []


class PuzzleDetails(BaseModel):
    premise: str = ""
    solution: str = ""
    hints: list[str] = []


class NavigationDetails(BaseModel):
    skill: Optional[str] = None
    dc: Optional[int] = None
    success: str = ""
    failure: str = ""


class EncounterExplorationBlockWrite(BaseModel):
    shape: Optional[str] = None
    environment: Optional[str] = None
    terrain_difficulty: Optional[str] = None
    obstacle_type: Optional[str] = None
    trap: Optional[TrapDetails] = None
    hazard: Optional[HazardDetails] = None
    skill_challenge: Optional[SkillChallengeDetails] = None
    puzzle: Optional[PuzzleDetails] = None
    sensory_clues: list[Any] = []
    points_of_interest: list[Any] = []
    navigation: Optional[NavigationDetails] = None
    resource_cost: list[str] = []
    verticality: bool = False
    complications: list[str] = []
    transition_encounter_id: Optional[uuid.UUID] = None
    wandering_table_id: Optional[uuid.UUID] = None


class EncounterExplorationBlockRead(EncounterExplorationBlockWrite):
    model_config = ConfigDict(from_attributes=True)
    encounter_id: uuid.UUID


class EncounterTableCreatureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    encounter_table_id: uuid.UUID
    creature_id: Optional[uuid.UUID] = None
    creature_name_raw: str
    quantity_formula: str
    sort_order: int
    # Denormalized from a join against creatures at read time (not stored columns)
    # so the client can show a real name/type without fetching the whole bestiary.
    creature_name: Optional[str] = None
    creature_type: Optional[str] = None
    creature_cr: Optional[str] = None
    token_asset_id: Optional[uuid.UUID] = None
    portrait_asset_id: Optional[uuid.UUID] = None


class EncounterTableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    encounter_id: uuid.UUID
    dice_expression: Optional[str] = None
    min_level: Optional[int] = None
    max_level: Optional[int] = None
    min: int
    max: int
    result_text: Optional[str] = None
    sort_order: int
    creatures: list[EncounterTableCreatureRead] = []


class RewardDetails(BaseModel):
    kind: str = "other"
    description: str = ""
    quantity: int = 1


class EncounterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    campaign_id: Optional[uuid.UUID] = None
    map_id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    page: Optional[int] = None
    resolution_type: str = "fixed"
    tables: Optional[Any] = None
    name: str
    description: Optional[str] = None
    challenge_rating_display: Optional[str] = None
    computed_adjusted_xp: Optional[int] = None
    computed_cr: Optional[str] = None
    difficulty: Optional[str] = None
    theme: Optional[str] = None
    encounter_type: Optional[str] = None
    possible_locations: Optional[list[str]] = None
    environment: Optional[str] = None
    tags: list[str] = []
    starting_positions: Optional[Any] = None
    special_rules: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None
    primary_type: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    status: str = "draft"
    read_aloud: Optional[str] = None
    objective: Optional[str] = None
    party_level_min: Optional[int] = None
    party_level_max: Optional[int] = None
    party_size: Optional[int] = None
    scaling_notes: Optional[str] = None
    location_id: Optional[uuid.UUID] = None
    rewards: Optional[list[RewardDetails]] = None
    created_at: datetime
    updated_at: datetime
    tag_ids: list[uuid.UUID] = []


class EncounterDetail(EncounterRead):
    creatures: list[EncounterCreatureRead] = []
    random_tables: list[EncounterTableRead] = []
    npcs: list[EncounterNpcRead] = []
    combat_block: Optional[EncounterCombatBlockRead] = None
    social_block: Optional[EncounterSocialBlockRead] = None
    exploration_block: Optional[EncounterExplorationBlockRead] = None


class EncounterCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    campaign_id: Optional[uuid.UUID] = None
    map_id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    page: Optional[int] = None
    resolution_type: str = "fixed"
    tables: Optional[Any] = None
    name: str
    description: Optional[str] = None
    challenge_rating_display: Optional[str] = None
    computed_adjusted_xp: Optional[int] = None
    computed_cr: Optional[str] = None
    difficulty: Optional[str] = None
    theme: Optional[str] = None
    encounter_type: Optional[str] = None
    possible_locations: Optional[list[str]] = None
    environment: Optional[str] = None
    tags: list[str] = []
    starting_positions: Optional[Any] = None
    special_rules: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None
    primary_type: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    status: str = "draft"
    read_aloud: Optional[str] = None
    objective: Optional[str] = None
    party_level_min: Optional[int] = None
    party_level_max: Optional[int] = None
    party_size: Optional[int] = None
    scaling_notes: Optional[str] = None
    location_id: Optional[uuid.UUID] = None
    rewards: list[RewardDetails] = []


class EncounterUpdate(BaseModel):
    campaign_id: Optional[uuid.UUID] = None
    map_id: Optional[uuid.UUID] = None
    source_id: Optional[uuid.UUID] = None
    page: Optional[int] = None
    resolution_type: Optional[str] = None
    tables: Optional[Any] = None
    name: Optional[str] = None
    description: Optional[str] = None
    challenge_rating_display: Optional[str] = None
    computed_adjusted_xp: Optional[int] = None
    computed_cr: Optional[str] = None
    difficulty: Optional[str] = None
    theme: Optional[str] = None
    encounter_type: Optional[str] = None
    possible_locations: Optional[list[str]] = None
    environment: Optional[str] = None
    tags: Optional[list[str]] = None
    starting_positions: Optional[Any] = None
    special_rules: Optional[Any] = None
    notes: Optional[str] = None
    raw_data: Optional[Any] = None
    primary_type: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    status: Optional[str] = None
    read_aloud: Optional[str] = None
    objective: Optional[str] = None
    party_level_min: Optional[int] = None
    party_level_max: Optional[int] = None
    party_size: Optional[int] = None
    scaling_notes: Optional[str] = None
    location_id: Optional[uuid.UUID] = None
    rewards: Optional[list[RewardDetails]] = None
