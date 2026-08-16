"""Stage 0: walk data/, classify every JSON file's top-level arrays against
a registry of known entity-type keys. Files/keys not in the registry still
come through - they just keep their raw JSON key as entity_type and land
in raw_entities only (never a schema mirror, but never silently dropped
either, per data_normalisation_plan.txt section 13).
"""
import json
import os

# Known 5etools top-level keys -> WorldWatcher entity_type.
# Keys with a "Fluff" suffix are handled generically in classify_file()
# (mapped_base + "_fluff"), not listed individually here.
ENTITY_TYPE_REGISTRY = {
    "monster": "creature",
    "spell": "spell",
    "item": "item",
    # baseitem (mundane weapons/armor/gear) and itemGroup are explicitly
    # "later" scope per database_scehma.txt 2.7 ("magic items today...
    # mundane items later") - raw-ingested but not projected into `items`
    # yet, kept as their own distinct entity_type rather than folded into
    # "item" so they're easy to find and promote later.
    "baseitem": "baseitem",
    "magicvariant": "item_variant",
    "itemGroup": "item_group",
    "condition": "condition",
    "disease": "disease",
    "status": "status",
    "class": "class",
    "subclass": "subclass",
    "classFeature": "class_feature",
    "subclassFeature": "subclass_feature",
    "raceFeature": "race_feature",
    "feat": "feat",
    "background": "background",
    "race": "race",
    "subrace": "subrace",
    "vehicle": "vehicle",
    "vehicleUpgrade": "vehicle_upgrade",
    "deity": "deity",
    "object": "object",
    "trap": "trap",
    "hazard": "hazard",
    "variantrule": "variantrule",
    "optionalfeature": "optionalfeature",
    "reward": "reward",
    "table": "table",
    "tableGroup": "table_group",
    "language": "language",
    "action": "action",
    "book": "book",
    "adventure": "adventure",
    "deck": "deck",
    "card": "card",
    "psionic": "psionic",
    "recipe": "recipe",
    "facility": "facility",
    "charoption": "charoption",
    "cult": "cult",
    "boon": "boon",
    "encounter": "encounter",
    "legendaryGroup": "legendary_group",
    "monsterTemplate": "monster_template",
}

# Files that are pure lookup/reference tables, not entity collections -
# still raw-ingested (Stage 2 is unconditional), just typed as 'unknown'
# unless the key is in the registry above.

# Fields checked (in this order) to build a deterministic source_key for
# a raw entity that doesn't otherwise have one.
NAME_FIELD_CANDIDATES = ("name",)
SOURCE_FIELD_CANDIDATES = ("source",)


def entity_type_for_key(key: str) -> str:
    if key in ENTITY_TYPE_REGISTRY:
        return ENTITY_TYPE_REGISTRY[key]
    if key.endswith("Fluff"):
        base = key[: -len("Fluff")]
        mapped = ENTITY_TYPE_REGISTRY.get(base, base)
        return f"{mapped}_fluff"
    return key  # unknown key -> still captured, typed by its own name


def walk_json_files(data_dir: str):
    for root, _dirs, files in os.walk(data_dir):
        for fn in files:
            if fn.lower().endswith(".json"):
                yield os.path.join(root, fn)


def classify_file(path: str):
    """Return a list of (entity_type, source_file_relpath, list_of_objects)
    for every top-level key in the file whose value is a list of dicts."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        return [], str(e)

    if not isinstance(data, dict):
        return [], None

    results = []
    for key, value in data.items():
        if isinstance(value, list) and value and isinstance(value[0], dict):
            results.append((entity_type_for_key(key), key, value))
    return results, None


def discover(data_dir: str):
    """Yields (entity_type, top_level_key, source_file_relpath, entity_obj)
    for every entity found under data_dir."""
    for path in walk_json_files(data_dir):
        rel = os.path.relpath(path, data_dir).replace(os.sep, "/")
        collections, err = classify_file(path)
        if err:
            yield ("__error__", None, rel, {"error": err})
            continue
        for entity_type, top_level_key, objs in collections:
            for obj in objs:
                yield (entity_type, top_level_key, rel, obj)
