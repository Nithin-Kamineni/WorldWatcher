"""promote encounter-table entries to structured encounters

Revision ID: 3a7c9e1d5b42
Revises: f6d3b9a5e0c8

Every rollable item beneath the Encounters category must resolve to a real
encounter card. This also repairs legacy ``encounter_ref`` entries whose
target was never populated. The original text/bundle is retained both on
the table entry and in encounters.raw_data, so this migration is lossless.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "3a7c9e1d5b42"
down_revision: Union[str, Sequence[str], None] = "f6d3b9a5e0c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Generate one stable encounter row for every unresolved encounter result.
    # The JSON marker lets the following UPDATE pair each generated UUID back
    # to its exact table entry without adding a permanent schema column.
    op.execute(
        """
        WITH RECURSIVE encounter_categories AS (
            SELECT id FROM category WHERE slug = 'encounters'
            UNION ALL
            SELECT c.id FROM category c
            JOIN encounter_categories parent ON c.parent_id = parent.id
        ), candidates AS (
            SELECT e.id AS entry_id, e.kind AS original_kind, e.text, e.bundle,
                   e.sort_order, rt.id AS table_id, rt.name AS table_name,
                   rt.campaign_id, rt.category_id,
                   CASE
                     WHEN EXISTS (
                       SELECT 1 FROM random_table_tag rtt JOIN tag t ON t.id = rtt.tag_id
                       WHERE rtt.table_id = rt.id AND t.namespace = 'pillar' AND t.value = 'social'
                     ) OR coalesce(e.text, '') ~* '(parley|negotia|merchant|diplomat|conversation|social)'
                       THEN 'social'
                     WHEN EXISTS (
                       SELECT 1 FROM random_table_tag rtt JOIN tag t ON t.id = rtt.tag_id
                       WHERE rtt.table_id = rt.id AND t.namespace = 'pillar' AND t.value = 'exploration'
                     ) OR coalesce(e.text, '') ~* '(explor|hazard|trap|clue|trail|weather|ruin)'
                       THEN 'exploration'
                     ELSE 'combat'
                   END AS pillar
            FROM table_entries e
            JOIN table_columns tc ON tc.id = e.column_id
            JOIN random_tables rt ON rt.id = tc.table_id
            WHERE e.encounter_id IS NULL
              AND (e.kind = 'encounter_ref' OR (e.kind = 'text' AND rt.category_id IN (SELECT id FROM encounter_categories)))
        )
        INSERT INTO encounters (
            id, campaign_id, name, description, resolution_type, primary_type,
            category_id, status, read_aloud, objective, theme, encounter_type,
            tags, raw_data
        )
        SELECT
            gen_random_uuid(), c.campaign_id,
            left(
              coalesce(
                nullif(trim(regexp_replace(regexp_replace(c.text, '^\\s*(?:\\d+d\\d+|\\d+)\\s+', '', 'i'), '[.!;].*$', '')), ''),
                nullif(c.bundle->>'name', ''),
                c.table_name || ' — Result ' || (c.sort_order + 1)
              ), 160
            ),
            coalesce(nullif(c.text, ''), jsonb_pretty(c.bundle), 'A result from ' || c.table_name || '.'),
            'fixed', c.pillar,
            coalesce(
              (SELECT id FROM category WHERE slug = 'encounters-' || c.pillar LIMIT 1),
              c.category_id
            ),
            'ready', nullif(c.text, ''),
            CASE c.pillar
              WHEN 'combat' THEN 'Resolve the threat, survive, or find another way past it.'
              WHEN 'social' THEN 'Learn what the other party wants and negotiate an outcome.'
              ELSE 'Investigate the situation and overcome the obstacle.'
            END,
            c.table_name, 'Random Table Encounter',
            ARRAY['random-table', 'migrated', c.pillar]::text[],
            jsonb_strip_nulls(jsonb_build_object(
              'migrated_from_table_entry_id', c.entry_id::text,
              'original_kind', c.original_kind,
              'table_id', c.table_id::text,
              'table_name', c.table_name,
              'text', c.text,
              'bundle', c.bundle
            ))
        FROM candidates c
        """
    )
    op.execute(
        """
        UPDATE table_entries e
        SET kind = 'encounter_ref', encounter_id = enc.id
        FROM encounters enc
        WHERE enc.raw_data->>'migrated_from_table_entry_id' = e.id::text
          AND e.encounter_id IS NULL
        """
    )

    # Classify and enrich encounters created by the earlier one-off migration
    # too. It made valid FK targets, but intentionally only populated a name,
    # description, and combat pillar.
    op.execute(
        """
        WITH source_table AS (
          SELECT DISTINCT ON (e.encounter_id)
            e.encounter_id, rt.id AS table_id, rt.name AS table_name,
            coalesce(e.text, enc.description) AS result_text
          FROM table_entries e
          JOIN table_columns tc ON tc.id = e.column_id
          JOIN random_tables rt ON rt.id = tc.table_id
          JOIN encounters enc ON enc.id = e.encounter_id
          WHERE e.kind = 'encounter_ref' AND e.encounter_id IS NOT NULL
          ORDER BY e.encounter_id, tc.sort_order, e.sort_order
        )
        UPDATE encounters enc
        SET status = 'ready',
            primary_type = coalesce(enc.primary_type, 'combat'),
            encounter_type = coalesce(enc.encounter_type, 'Random Table Encounter'),
            theme = coalesce(enc.theme, st.table_name),
            description = coalesce(nullif(enc.description, ''), st.result_text),
            read_aloud = coalesce(enc.read_aloud, st.result_text),
            objective = coalesce(enc.objective,
              CASE coalesce(enc.primary_type, 'combat')
                WHEN 'social' THEN 'Learn what the other party wants and negotiate an outcome.'
                WHEN 'exploration' THEN 'Investigate the situation and overcome the obstacle.'
                ELSE 'Resolve the threat, survive, or find another way past it.'
              END),
            tags = ARRAY(SELECT DISTINCT value FROM unnest(coalesce(enc.tags, ARRAY[]::text[]) || ARRAY['random-table', coalesce(enc.primary_type, 'combat')]) value),
            raw_data = coalesce(enc.raw_data, '{}'::jsonb) || jsonb_build_object('random_table_id', st.table_id::text, 'random_table_name', st.table_name)
        FROM source_table st
        WHERE enc.id = st.encounter_id
        """
    )

    # Carry the table's normalized vocabulary onto each encounter card.
    op.execute(
        """
        INSERT INTO encounter_tag (encounter_id, tag_id)
        SELECT DISTINCT e.encounter_id, rtt.tag_id
        FROM table_entries e
        JOIN table_columns tc ON tc.id = e.column_id
        JOIN random_table_tag rtt ON rtt.table_id = tc.table_id
        WHERE e.encounter_id IS NOT NULL
        ON CONFLICT DO NOTHING
        """
    )

    # Seed a useful structured block instead of leaving promoted cards as a
    # title plus prose. Users can refine these fields later in the editor.
    op.execute(
        """
        INSERT INTO encounter_combat_blocks (encounter_id, shape, victory_condition, awareness, terrain_features, morale, dynamic_events, aftermath, has_lair_or_legendary)
        SELECT id, 'skirmish', 'defeat_all', 'mutual', '[]'::jsonb,
               'flees_50pct', '[]'::jsonb, '[]'::jsonb, false
        FROM encounters
        WHERE primary_type = 'combat' AND tags @> ARRAY['random-table']::text[]
        ON CONFLICT (encounter_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO encounter_social_blocks (encounter_id, shape, tone, stakes, player_levers, key_checks, gated_info, complications)
        SELECT id, 'negotiation', 'mysterious', 'information',
               '["Offer help", "Share information", "Appeal to a bond"]'::jsonb,
               '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
        FROM encounters
        WHERE primary_type = 'social' AND tags @> ARRAY['random-table']::text[]
        ON CONFLICT (encounter_id) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO encounter_exploration_blocks (encounter_id, shape, obstacle_type, sensory_clues, points_of_interest, resource_cost, verticality, complications)
        SELECT id, 'investigation_discovery', 'natural_feature',
               jsonb_build_array(jsonb_build_object('sense', 'sight', 'detail', coalesce(read_aloud, description, name), 'perceiveDc', NULL)),
               '[]'::jsonb, '[]'::jsonb, false, '[]'::jsonb
        FROM encounters
        WHERE primary_type = 'exploration' AND tags @> ARRAY['random-table']::text[]
        ON CONFLICT (encounter_id) DO NOTHING
        """
    )


def downgrade() -> None:
    # Only remove rows that this revision generated. Enrichment of older valid
    # encounters is intentionally retained because it is useful user-visible data.
    op.execute(
        """
        UPDATE table_entries e
        SET kind = coalesce(enc.raw_data->>'original_kind', 'text'), encounter_id = NULL
        FROM encounters enc
        WHERE e.encounter_id = enc.id
          AND enc.raw_data ? 'migrated_from_table_entry_id'
        """
    )
    op.execute("DELETE FROM encounters WHERE raw_data ? 'migrated_from_table_entry_id'")
