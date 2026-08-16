"""Stage 4 (bastion_facility). Bugs.txt #5 - the D&D 2024 Bastion system's facility
catalog (Database/external-data/5etools-src/data/bastions.json, top-level key
"facility"), field-mapped the same way spell.py/item.py map their 5etools JSON."""
import json

from .. import db as db_mod
from .. import sources as sources_mod
from ..hashing import slugify
from ..text import flatten_entry


def format_space(space) -> list:
    if isinstance(space, list):
        return [str(s) for s in space]
    if space:
        return [str(space)]
    return []


def project_bastion_facility(cur, facility: dict, source_cache: dict):
    source_id = sources_mod.get_or_create_source(cur, source_cache, facility.get("source"))
    name = facility.get("name") or "(unnamed)"
    slug = slugify(name)

    values = {
        "source_id": source_id,
        "name": name,
        "slug": slug,
        "facility_type": facility.get("facilityType") or "basic",
        "space": json.dumps(format_space(facility.get("space"))),
        "prerequisite_level": facility.get("level"),
        "hirelings": json.dumps(facility["hirelings"]) if "hirelings" in facility else None,
        "orders": json.dumps(facility["orders"]) if "orders" in facility else None,
        "description": flatten_entry(facility.get("entries")) or None,
        "page": facility.get("page"),
        "raw_data": json.dumps(facility),
    }

    facility_id, was_insert = db_mod.upsert(
        cur, "bastion_facilities", ["slug", "source_id"], values, conflict_where="source_id IS NOT NULL"
    )
    return facility_id, was_insert
