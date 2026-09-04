"""preserve dice counts parsed from imported encounter prose

Revision ID: 7e3c5a1d9f42
Revises: 6d1a9c4e7b20
"""
import re
from collections import defaultdict
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "7e3c5a1d9f42"
down_revision: Union[str, Sequence[str], None] = "6d1a9c4e7b20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CR_XP = {"0":10,"1/8":25,"1/4":50,"1/2":100,"1":200,"2":450,"3":700,"4":1100,"5":1800,"6":2300,"7":2900,"8":3900,"9":5000,"10":5900,"11":7200,"12":8400,"13":10000,"14":11500,"15":13000,"16":15000,"17":18000,"18":20000,"19":22000,"20":25000,"21":33000,"22":41000,"23":50000,"24":62000,"25":75000,"26":90000,"27":105000,"28":120000,"29":135000,"30":155000}
WORDS = {"a":1,"an":1,"one":1,"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,"eight":8,"nine":9,"ten":10}


def formula_in(prose: str, name: str, fallback: int) -> str:
    match = re.search(rf"(?:^|\b)(\d+d\d+(?:\s*[+-]\s*\d+)?|\d+|{'|'.join(WORDS)})\s+{re.escape(name)}s?\b", prose, re.I)
    if not match:
        return str(fallback)
    token = match.group(1).lower().replace(" ", "")
    return str(WORDS.get(token, token))


def average(formula: str) -> float:
    match = re.fullmatch(r"(\d+)d(\d+)(?:([+-])(\d+))?", formula, re.I)
    if not match:
        return float(formula) if formula.isdigit() else 1
    result = int(match.group(1)) * (int(match.group(2)) + 1) / 2
    if match.group(3):
        result += int(match.group(4)) * (1 if match.group(3) == "+" else -1)
    return max(0, result)


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("""
      SELECT e.id AS encounter_id, e.description, ec.id AS entry_id, ec.quantity, c.name, c.challenge_rating_display AS cr
      FROM encounters e JOIN encounter_creatures ec ON ec.encounter_id=e.id JOIN creatures c ON c.id=ec.creature_id
      WHERE e.description IS NOT NULL AND (e.source_id IS NOT NULL OR e.tags @> ARRAY['random-table']::text[])
    """)).mappings()
    xp_by_encounter = defaultdict(float)
    for row in rows:
        formula = formula_in(row["description"], row["name"], row["quantity"])
        xp_by_encounter[row["encounter_id"]] += average(formula) * CR_XP.get(row["cr"] or "", 0)
        bind.execute(sa.text("""UPDATE encounter_creatures SET raw_data=coalesce(raw_data, '{}'::jsonb) || jsonb_build_object('quantity_formula', :formula) WHERE id=:id"""), {"formula": formula, "id": row["entry_id"]})
    for encounter_id, xp in xp_by_encounter.items():
        value = round(xp)
        bind.execute(sa.text("UPDATE encounters SET computed_adjusted_xp=:xp WHERE id=:id"), {"xp": value, "id": encounter_id})
        bind.execute(sa.text("UPDATE encounter_combat_blocks SET computed_xp=:xp WHERE encounter_id=:id"), {"xp": value, "id": encounter_id})


def downgrade() -> None:
    pass
