"""Stage 4 (condition/disease/status). Field mapping per
data_normalisation_plan.txt section 4.4."""
import json

from .. import db as db_mod
from .. import sources as sources_mod
from ..text import flatten_entry


def project_condition(cur, entity: dict, condition_type: str, source_cache: dict):
    source_id = sources_mod.get_or_create_source(cur, source_cache, entity.get("source"))
    name = entity.get("name") or "(unnamed)"

    values = {
        "source_id": source_id,
        "name": name,
        "condition_type": condition_type,
        "description": flatten_entry(entity.get("entries")),
        "raw_data": json.dumps(entity),
    }

    condition_id, was_insert = db_mod.upsert(cur, "conditions", ["name", "source_id"], values)
    return condition_id, was_insert
