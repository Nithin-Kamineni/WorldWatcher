"""turn imported encounter prose into concise, runnable encounter cards

Revision ID: 8b2f6d4a1c90
Revises: 3a7c9e1d5b42
"""
from typing import Sequence, Union

from alembic import op

revision: str = "8b2f6d4a1c90"
down_revision: Union[str, Sequence[str], None] = "3a7c9e1d5b42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Imported names were encounter prose. Keep every word as the description,
    # then give the card a short, evocative title. Duplicate titles receive a
    # small ordinal so the existing (name, source_id) uniqueness is preserved.
    op.execute("""
      WITH candidates AS (
        SELECT id, source_id, name AS old_name, coalesce(nullif(description, ''), name) AS prose,
          CASE
            WHEN lower(coalesce(description, name)) ~ 'airship|flying ship' AND lower(coalesce(description, name)) ~ 'pirate' THEN 'Raiders of the Open Sky'
            WHEN lower(coalesce(description, name)) ~ 'pirate|buccaneer|corsair' THEN 'The Black-Sail Ambush'
            WHEN lower(coalesce(description, name)) ~ 'dragon' THEN 'Wings on the Horizon'
            WHEN lower(coalesce(description, name)) ~ 'undead|skeleton|zombie|wight|wraith|ghost' THEN 'The Restless Dead'
            WHEN lower(coalesce(description, name)) ~ 'fiend|demon|devil' THEN 'A Bargain in Brimstone'
            WHEN lower(coalesce(description, name)) ~ 'celestial|angel|deva' THEN 'Judgment from Above'
            WHEN lower(coalesce(description, name)) ~ 'giant' THEN 'Footfalls Like Thunder'
            WHEN lower(coalesce(description, name)) ~ 'goblin|hobgoblin|bugbear' THEN 'Knives in the Brush'
            WHEN lower(coalesce(description, name)) ~ 'bandit|brigand|thug' THEN 'The Roadside Reckoning'
            WHEN lower(coalesce(description, name)) ~ 'merchant|trader|caravan' THEN 'Terms on the Road'
            WHEN lower(coalesce(description, name)) ~ 'storm|lightning|thunder' THEN 'Under a Wrathful Sky'
            WHEN lower(coalesce(description, name)) ~ 'ruin|temple|tomb|crypt' THEN 'Secrets Beneath the Stones'
            WHEN lower(coalesce(description, name)) ~ 'forest|wood|grove' THEN 'Whispers Between the Trees'
            WHEN lower(coalesce(description, name)) ~ 'sea|ocean|ship|sailor' THEN 'Trouble on the Tide'
            WHEN lower(coalesce(description, name)) ~ 'cave|cavern|underdark' THEN 'Echoes in the Deep'
            WHEN primary_type = 'social' THEN 'An Unexpected Proposition'
            WHEN primary_type = 'exploration' THEN 'The Hidden Way Forward'
            ELSE 'Danger at the Crossroads'
          END AS base_name
        FROM encounters
        WHERE (source_id IS NOT NULL OR tags @> ARRAY['random-table']::text[])
          AND (length(name) > 48 OR name = coalesce(description, name))
      ), numbered AS (
        SELECT *, row_number() OVER (PARTITION BY source_id, base_name ORDER BY id) AS ordinal,
                  count(*) OVER (PARTITION BY source_id, base_name) AS copies
        FROM candidates
      )
      UPDATE encounters e
      SET description = n.prose,
          name = left(n.base_name || CASE WHEN n.copies > 1 THEN ' ' || n.ordinal ELSE '' END, 160),
          read_aloud = coalesce(e.read_aloud, n.prose),
          objective = CASE coalesce(e.primary_type, 'combat')
            WHEN 'social' THEN 'Discover what the other party truly wants and secure an agreement without creating a new enemy.'
            WHEN 'exploration' THEN 'Identify the danger, find a safe route through it, and preserve any useful clues.'
            ELSE 'Break the opposition''s advantage and force it to retreat, surrender, or yield the objective.'
          END,
          status = 'ready'
      FROM numbered n WHERE e.id = n.id
    """)

    # Derive display tags from the linked bestiary records. These are useful
    # even when the normalized vocabulary table has no matching imported tag.
    op.execute("""
      WITH inferred AS (
        SELECT et.encounter_id, array_agg(DISTINCT lower(c.creature_type)) FILTER (WHERE c.creature_type IS NOT NULL) AS types
        FROM encounter_tables et
        JOIN encounter_table_creatures etc ON etc.encounter_table_id = et.id
        JOIN creatures c ON c.id = etc.creature_id
        GROUP BY et.encounter_id
      )
      UPDATE encounters e
      SET tags = ARRAY(SELECT DISTINCT value FROM unnest(coalesce(e.tags, ARRAY[]::text[]) || coalesce(i.types, ARRAY[]::text[])) value)
      FROM inferred i WHERE i.encounter_id = e.id
    """)

    # Calculate expected XP from linked creatures. Dice quantities use their
    # mathematical average (2d4+1 => 6), while the card keeps displaying the
    # original formula so the DM still rolls the actual count at the table.
    op.execute("""
      WITH roster AS (
        SELECT ec.encounter_id, c.challenge_rating_display AS cr, ec.quantity::numeric AS quantity
        FROM encounter_creatures ec JOIN creatures c ON c.id = ec.creature_id
        UNION ALL
        SELECT et.encounter_id, c.challenge_rating_display,
          CASE
            WHEN etc.quantity_formula ~ '^\\d+$' THEN etc.quantity_formula::numeric
            WHEN etc.quantity_formula ~* '^\\d+d\\d+(?:[+-]\\d+)?$' THEN
              (regexp_replace(etc.quantity_formula, '^([0-9]+)d.*$', '\\1', 'i'))::numeric *
              ((regexp_replace(etc.quantity_formula, '^[0-9]+d([0-9]+).*$','\\1','i'))::numeric + 1) / 2 +
              coalesce(nullif(substring(etc.quantity_formula from '([+-][0-9]+)$'), '')::numeric, 0)
            ELSE 1
          END
        FROM encounter_tables et
        JOIN encounter_table_creatures etc ON etc.encounter_table_id = et.id
        JOIN creatures c ON c.id = etc.creature_id
      ), valued AS (
        SELECT encounter_id, cr, quantity * CASE cr
          WHEN '0' THEN 10 WHEN '1/8' THEN 25 WHEN '1/4' THEN 50 WHEN '1/2' THEN 100
          WHEN '1' THEN 200 WHEN '2' THEN 450 WHEN '3' THEN 700 WHEN '4' THEN 1100 WHEN '5' THEN 1800
          WHEN '6' THEN 2300 WHEN '7' THEN 2900 WHEN '8' THEN 3900 WHEN '9' THEN 5000 WHEN '10' THEN 5900
          WHEN '11' THEN 7200 WHEN '12' THEN 8400 WHEN '13' THEN 10000 WHEN '14' THEN 11500 WHEN '15' THEN 13000
          WHEN '16' THEN 15000 WHEN '17' THEN 18000 WHEN '18' THEN 20000 WHEN '19' THEN 22000 WHEN '20' THEN 25000
          WHEN '21' THEN 33000 WHEN '22' THEN 41000 WHEN '23' THEN 50000 WHEN '24' THEN 62000 WHEN '25' THEN 75000
          WHEN '26' THEN 90000 WHEN '27' THEN 105000 WHEN '28' THEN 120000 WHEN '29' THEN 135000 WHEN '30' THEN 155000 ELSE 0 END AS xp
        FROM roster
      ), totals AS (
        SELECT encounter_id, round(sum(xp))::integer AS xp, string_agg(DISTINCT cr, ', ' ORDER BY cr) FILTER (WHERE cr IS NOT NULL) AS crs
        FROM valued GROUP BY encounter_id
      )
      UPDATE encounters e SET computed_adjusted_xp = t.xp, challenge_rating_display = coalesce(e.challenge_rating_display, t.crs)
      FROM totals t WHERE t.encounter_id = e.id
    """)

    # Fill the practical combat defaults requested for cards that predate the
    # run-layer. Existing DM-authored values always win.
    op.execute("""
      UPDATE encounter_combat_blocks b SET
        victory_condition = coalesce(b.victory_condition, 'break_morale'),
        awareness = coalesce(b.awareness, 'mutual'),
        morale = coalesce(b.morale, 'flees_leader_falls'),
        computed_xp = coalesce(b.computed_xp, e.computed_adjusted_xp)
      FROM encounters e
      WHERE e.id = b.encounter_id
        AND (e.source_id IS NOT NULL OR e.tags @> ARRAY['random-table']::text[])
    """)


def downgrade() -> None:
    # Descriptions and enrichment are intentionally retained. Reconstructing
    # long prose titles would make the product worse and is not lossless once
    # a user has edited a title after migration.
    pass
