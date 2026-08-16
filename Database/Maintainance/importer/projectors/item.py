"""Stage 4 (item). Field mapping per data_normalisation_plan.txt section 4.3."""
import json

from .. import db as db_mod
from .. import sources as sources_mod
from ..hashing import slugify
from ..text import flatten_entry

RARITY_MAP = {
    "none": "common", "common": "common", "uncommon": "uncommon", "rare": "rare",
    "very rare": "very-rare", "legendary": "legendary", "artifact": "artifact",
    "unknown": "unknown", "unknown (magic)": "unknown", "varies": "varies",
}

# Boolean flags 5etools sets on an item that imply a coarse item_type when
# no explicit `type` code is present or resolvable without the itemType
# lookup table.
TYPE_FLAG_LABELS = (
    ("wondrous", "Wondrous Item"),
    ("staff", "Staff"),
    ("rod", "Rod"),
    ("wand", "Wand"),
    ("ring", "Ring"),
    ("weapon", "Weapon"),
    ("armor", "Armor"),
    ("firearm", "Firearm"),
    ("ammo", "Ammunition"),
    ("poison", "Poison"),
    ("vehicle", "Vehicle"),
)


def format_item_type(item: dict):
    # Boolean flags (staff/rod/wand/wondrous/...) give a human-readable
    # label directly. The raw `type` field is often a short 5etools code
    # (e.g. "M|XPHB") that needs the itemType.json lookup table to resolve
    # properly - out of scope for this thin translation layer - so prefer
    # a matching flag first and only fall back to the raw code otherwise.
    for flag, label in TYPE_FLAG_LABELS:
        if item.get(flag):
            return label
    raw_type = item.get("type") or item.get("typeAlt")
    if isinstance(raw_type, str) and raw_type:
        return raw_type.split("|")[0]
    return None


def format_rarity(item: dict):
    rarity = (item.get("rarity") or "").strip().lower()
    return RARITY_MAP.get(rarity, "unknown")


def format_attunement(item: dict):
    ra = item.get("reqAttune")
    if ra is True:
        return True, None
    if isinstance(ra, str):
        low = ra.strip().lower()
        if low in ("false", "none", ""):
            return False, None
        if low == "true":
            return True, None
        return True, ra
    return False, None


def project_item(cur, item: dict, source_cache: dict):
    source_id = sources_mod.get_or_create_source(cur, source_cache, item.get("source"))
    name = item.get("name") or "(unnamed)"
    slug = slugify(name)
    requires_attunement, attunement_requirement = format_attunement(item)

    charges_val = item.get("charges")
    recharge_text = item.get("recharge")
    charges = (
        json.dumps({"charges": charges_val, "recharge": recharge_text})
        if charges_val is not None or recharge_text is not None
        else None
    )

    values = {
        "source_id": source_id,
        "campaign_id": None,
        "name": name,
        "slug": slug,
        "edition": None,
        "item_type": format_item_type(item),
        "rarity": format_rarity(item),
        "requires_attunement": requires_attunement,
        "attunement_requirement": attunement_requirement,
        "weight": item.get("weight"),
        "cost": json.dumps({"value": item["value"], "unit": "cp"}) if "value" in item else None,
        "description": flatten_entry(item.get("entries")),
        "properties": json.dumps(item["property"]) if "property" in item else None,
        "effects": None,
        "charges": charges,
        "image_asset_id": None,
        "raw_data": json.dumps(item),
    }

    item_id, was_insert = db_mod.upsert(
        cur, "items", ["slug", "source_id"], values, conflict_where="source_id IS NOT NULL"
    )
    return item_id, was_insert
