"""encounter overhaul: shared run layer + combat/social/exploration blocks

Revision ID: c1d8f3a6e9b4
Revises: b7e4f9a2c8d1
Create Date: 2026-09-01 00:00:00.000003

Hand-written per the baseline revision's own guidance - 001_schema.sql remains
the source of truth for indexes/constraints and is updated alongside this
migration.

Tasks 7-10 of the Random Tables build prompt. Extends the existing
`encounters`/`encounter_creatures` tables (reused, not replaced, to keep
their existing FKs from map_floors/map_tokens/encounter_tables intact) with
the shared "run layer" fields, then adds one optional 1:1 child table per
pillar (combat/social/exploration - an encounter can carry more than one
block at once, e.g. a parley that turns into a fight) plus `encounter_npcs`
(the social roster, joined to the existing `creatures` table where
category='npc', mirroring how `encounter_creatures` already joins combat
rosters to `creatures` where category='monster').
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1d8f3a6e9b4'
down_revision: Union[str, Sequence[str], None] = 'b7e4f9a2c8d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- shared run layer on encounters ---
    op.add_column("encounters", sa.Column("primary_type", sa.Text()))
    op.add_column("encounters", sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("category.id")))
    op.add_column("encounters", sa.Column("status", sa.Text(), nullable=False, server_default="draft"))
    op.add_column("encounters", sa.Column("read_aloud", sa.Text()))
    op.add_column("encounters", sa.Column("objective", sa.Text()))
    op.add_column("encounters", sa.Column("party_level_min", sa.Integer()))
    op.add_column("encounters", sa.Column("party_level_max", sa.Integer()))
    op.add_column("encounters", sa.Column("party_size", sa.Integer()))
    op.add_column("encounters", sa.Column("scaling_notes", sa.Text()))
    op.add_column("encounters", sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id")))
    op.add_column("encounters", sa.Column("rewards", postgresql.JSONB()))
    op.create_check_constraint("encounters_primary_type_check", "encounters", "primary_type IS NULL OR primary_type IN ('combat','social','exploration')")
    op.create_check_constraint("encounters_status_check", "encounters", "status IN ('draft','ready','used')")
    op.create_index("encounters_category_id_idx", "encounters", ["category_id"])
    op.create_index("encounters_location_id_idx", "encounters", ["location_id"])
    op.create_index("encounters_primary_type_idx", "encounters", ["primary_type"])

    # --- combat roster gets a role + notes (Task 8.1) ---
    op.add_column("encounter_creatures", sa.Column("role", sa.Text()))
    op.add_column("encounter_creatures", sa.Column("notes", sa.Text()))
    op.create_check_constraint(
        "encounter_creatures_role_check",
        "encounter_creatures",
        "role IS NULL OR role IN ('minion','skirmisher','brute','soldier','artillery','controller','lurker','leader','solo_boss','support_healer')",
    )

    # --- combat block (Task 8) ---
    op.create_table(
        "encounter_combat_blocks",
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("shape", sa.Text()),
        sa.Column("victory_condition", sa.Text()),
        sa.Column("awareness", sa.Text()),
        sa.Column("start_range", sa.Text()),
        sa.Column("lighting", sa.Text()),
        sa.Column("terrain_type", sa.Text()),
        sa.Column("terrain_features", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("morale", sa.Text()),
        sa.Column("reinforcements", postgresql.JSONB()),
        sa.Column("dynamic_events", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("difficulty_band", sa.Text()),
        sa.Column("computed_xp", sa.Integer()),
        sa.Column("has_lair_or_legendary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("aftermath", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("scaling_notes", sa.Text()),
        sa.Column("map_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("maps.id")),
        sa.CheckConstraint(
            "shape IS NULL OR shape IN ('ambush','skirmish','set_piece_boss','horde_swarm','waves_gauntlet','duel','siege','chase','escort_defense','puzzle_combat')",
            name="encounter_combat_blocks_shape_check",
        ),
        sa.CheckConstraint(
            "victory_condition IS NULL OR victory_condition IN ('defeat_all','defeat_leader','survive_rounds','protect_escort','reach_escape','retrieve_destroy','capture_alive','hold_position','slip_past','break_morale')",
            name="encounter_combat_blocks_victory_check",
        ),
        sa.CheckConstraint(
            "awareness IS NULL OR awareness IN ('party_surprised','enemies_surprised','mutual','stealth_approach')",
            name="encounter_combat_blocks_awareness_check",
        ),
        sa.CheckConstraint(
            "start_range IS NULL OR start_range IN ('melee','close','medium','long','variable')",
            name="encounter_combat_blocks_start_range_check",
        ),
        sa.CheckConstraint(
            "lighting IS NULL OR lighting IN ('bright','dim','darkness','magical_darkness')",
            name="encounter_combat_blocks_lighting_check",
        ),
        sa.CheckConstraint(
            "terrain_type IS NULL OR terrain_type IN ('open','dense_forest','corridor_cramped','cavern','rooftops_urban','bridge_chokepoint','water_swamp','vertical_cliffs','ruins_rubble','interior_room')",
            name="encounter_combat_blocks_terrain_type_check",
        ),
        sa.CheckConstraint(
            "morale IS NULL OR morale IN ('fights_to_death','flees_50pct','flees_leader_falls','surrenders_losing','parleys','retreats_reinforce','fanatical')",
            name="encounter_combat_blocks_morale_check",
        ),
        sa.CheckConstraint(
            "difficulty_band IS NULL OR difficulty_band IN ('low','moderate','high','easy','medium','hard','deadly')",
            name="encounter_combat_blocks_difficulty_band_check",
        ),
    )

    # --- social block (Task 9) ---
    op.create_table(
        "encounter_social_blocks",
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("shape", sa.Text()),
        sa.Column("venue", sa.Text()),
        sa.Column("tone", sa.Text()),
        sa.Column("stakes", sa.Text()),
        sa.Column("player_levers", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("key_checks", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("outcome_tiers", postgresql.JSONB()),
        sa.Column("social_clock", postgresql.JSONB()),
        sa.Column("gated_info", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("complications", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("escalation", sa.Text()),
        sa.CheckConstraint(
            "shape IS NULL OR shape IN ('negotiation','interrogation','request_persuasion','deception_infiltration','intimidation','haggle_bargain','court_audience','trial','info_gathering','recruitment','calming_hostility','debate','performance','verbal_puzzle')",
            name="encounter_social_blocks_shape_check",
        ),
        sa.CheckConstraint(
            "venue IS NULL OR venue IN ('tavern','court_throne_room','street_market','prison','temple','guild_hall','camp','private_residence','battlefield_parley','shop')",
            name="encounter_social_blocks_venue_check",
        ),
        sa.CheckConstraint(
            "tone IS NULL OR tone IN ('tense','cordial','formal','comedic','threatening','somber','mysterious')",
            name="encounter_social_blocks_tone_check",
        ),
        sa.CheckConstraint(
            "stakes IS NULL OR stakes IN ('information','ally_introduction','item_reward','safe_passage','job_quest','a_life','contract_deal','access','nothing')",
            name="encounter_social_blocks_stakes_check",
        ),
        sa.CheckConstraint(
            "escalation IS NULL OR escalation IN ('can_turn_combat','can_turn_chase','locks_out_if_failed','alerts_others')",
            name="encounter_social_blocks_escalation_check",
        ),
    )

    op.create_table(
        "encounter_npcs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("npc_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("creatures.id"), nullable=False),
        sa.Column("attitude", sa.Text()),
        sa.Column("agenda", sa.Text()),
        sa.Column("secret", sa.Text()),
        sa.Column("leverage", sa.Text()),
        sa.Column("rp_cues", postgresql.JSONB()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint(
            "attitude IS NULL OR attitude IN ('hostile','unfriendly','indifferent','friendly','helpful')",
            name="encounter_npcs_attitude_check",
        ),
        sa.CheckConstraint(
            "agenda IS NULL OR agenda IN ('wants_money','wants_protection','wants_information','wants_revenge','wants_recruit','wants_deceive','wants_escape','wants_status','hiding_secret','testing_party')",
            name="encounter_npcs_agenda_check",
        ),
    )
    op.create_index("encounter_npcs_encounter_id_idx", "encounter_npcs", ["encounter_id"])
    op.create_index("encounter_npcs_npc_id_idx", "encounter_npcs", ["npc_id"])

    # --- exploration block (Task 10) ---
    op.create_table(
        "encounter_exploration_blocks",
        sa.Column("encounter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("encounters.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("shape", sa.Text()),
        sa.Column("environment", sa.Text()),
        sa.Column("terrain_difficulty", sa.Text()),
        sa.Column("obstacle_type", sa.Text()),
        sa.Column("trap", postgresql.JSONB()),
        sa.Column("hazard", postgresql.JSONB()),
        sa.Column("skill_challenge", postgresql.JSONB()),
        sa.Column("puzzle", postgresql.JSONB()),
        sa.Column("sensory_clues", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("points_of_interest", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("navigation", postgresql.JSONB()),
        sa.Column("resource_cost", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("verticality", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("complications", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.CheckConstraint(
            "shape IS NULL OR shape IN ('navigation_travel','dungeon_delve','trap','hazard','puzzle','investigation_discovery','survival','traversal','timed_escape','skill_challenge','environmental_set_piece','stealth_infiltration')",
            name="encounter_exploration_blocks_shape_check",
        ),
        sa.CheckConstraint(
            "environment IS NULL OR environment IN ('forest','mountain','desert','swamp','arctic','coast','sea','underdark','urban','dungeon','ruins','jungle','grassland','feywild','shadowfell','planar')",
            name="encounter_exploration_blocks_environment_check",
        ),
        sa.CheckConstraint(
            "terrain_difficulty IS NULL OR terrain_difficulty IN ('normal','difficult','hazardous','impassable')",
            name="encounter_exploration_blocks_terrain_difficulty_check",
        ),
        sa.CheckConstraint(
            "obstacle_type IS NULL OR obstacle_type IN ('physical_barrier','trap','environmental_hazard','locked_sealed','puzzle_mechanism','guardian','natural_feature','maze_navigation')",
            name="encounter_exploration_blocks_obstacle_type_check",
        ),
    )


def downgrade() -> None:
    op.drop_table("encounter_exploration_blocks")
    op.drop_table("encounter_npcs")
    op.drop_table("encounter_social_blocks")
    op.drop_table("encounter_combat_blocks")
    op.drop_constraint("encounter_creatures_role_check", "encounter_creatures", type_="check")
    op.drop_column("encounter_creatures", "notes")
    op.drop_column("encounter_creatures", "role")
    op.drop_index("encounters_primary_type_idx", table_name="encounters")
    op.drop_index("encounters_location_id_idx", table_name="encounters")
    op.drop_index("encounters_category_id_idx", table_name="encounters")
    op.drop_constraint("encounters_status_check", "encounters", type_="check")
    op.drop_constraint("encounters_primary_type_check", "encounters", type_="check")
    for col in ["rewards", "location_id", "scaling_notes", "party_size", "party_level_max", "party_level_min", "objective", "read_aloud", "status", "category_id", "primary_type"]:
        op.drop_column("encounters", col)
