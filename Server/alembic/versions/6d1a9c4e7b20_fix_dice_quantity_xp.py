"""calculate imported encounter XP from dice quantity formulas

Revision ID: 6d1a9c4e7b20
Revises: 8b2f6d4a1c90
"""
from typing import Sequence, Union

from alembic import op

revision: str = "6d1a9c4e7b20"
down_revision: Union[str, Sequence[str], None] = "8b2f6d4a1c90"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
      WITH imported AS (
        SELECT e.id AS encounter_id, c.challenge_rating_display AS cr,
          coalesce(ic->>'countDice', ic->>'countFixed', '1') AS formula
        FROM encounters e
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(e.tables, '[]'::jsonb)) source_table
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(source_table->'table', '[]'::jsonb)) source_row
        CROSS JOIN LATERAL jsonb_array_elements(coalesce(source_row->'creatures', '[]'::jsonb)) ic
        JOIN creatures c ON lower(c.name) = lower(ic->>'name')
      ), valued AS (
        SELECT encounter_id,
          CASE
            WHEN formula ~ '^\\d+$' THEN formula::numeric
            WHEN formula ~* '^\\d+d\\d+(?:[+-]\\d+)?$' THEN
              (regexp_replace(formula, '^([0-9]+)d.*$', '\\1', 'i'))::numeric *
              ((regexp_replace(formula, '^[0-9]+d([0-9]+).*$','\\1','i'))::numeric + 1) / 2 +
              coalesce(nullif(substring(formula from '([+-][0-9]+)$'), '')::numeric, 0)
            ELSE 1
          END * CASE cr
            WHEN '0' THEN 10 WHEN '1/8' THEN 25 WHEN '1/4' THEN 50 WHEN '1/2' THEN 100
            WHEN '1' THEN 200 WHEN '2' THEN 450 WHEN '3' THEN 700 WHEN '4' THEN 1100 WHEN '5' THEN 1800
            WHEN '6' THEN 2300 WHEN '7' THEN 2900 WHEN '8' THEN 3900 WHEN '9' THEN 5000 WHEN '10' THEN 5900
            WHEN '11' THEN 7200 WHEN '12' THEN 8400 WHEN '13' THEN 10000 WHEN '14' THEN 11500 WHEN '15' THEN 13000
            WHEN '16' THEN 15000 WHEN '17' THEN 18000 WHEN '18' THEN 20000 WHEN '19' THEN 22000 WHEN '20' THEN 25000
            WHEN '21' THEN 33000 WHEN '22' THEN 41000 WHEN '23' THEN 50000 WHEN '24' THEN 62000 WHEN '25' THEN 75000
            WHEN '26' THEN 90000 WHEN '27' THEN 105000 WHEN '28' THEN 120000 WHEN '29' THEN 135000 WHEN '30' THEN 155000 ELSE 0 END AS xp
        FROM imported
      ), totals AS (
        SELECT encounter_id, round(sum(xp))::integer AS xp FROM valued GROUP BY encounter_id
      )
      UPDATE encounters e SET computed_adjusted_xp = totals.xp FROM totals WHERE totals.encounter_id = e.id
    """)
    op.execute("""
      UPDATE encounter_combat_blocks b SET computed_xp = e.computed_adjusted_xp
      FROM encounters e WHERE e.id = b.encounter_id AND e.computed_adjusted_xp IS NOT NULL
    """)


def downgrade() -> None:
    pass
