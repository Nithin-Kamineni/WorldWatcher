"""Stage 4 (spell). Field mapping per data_normalisation_plan.txt section 4.2."""
import json

from .. import db as db_mod
from .. import sources as sources_mod
from ..hashing import slugify
from ..text import flatten_entry, strip_tags

SCHOOL_MAP = {
    "A": "Abjuration", "C": "Conjuration", "D": "Divination", "E": "Enchantment",
    "V": "Evocation", "I": "Illusion", "N": "Necromancy", "T": "Transmutation",
    "P": "Psionic",
}


def format_school(code):
    if not code:
        return None
    return SCHOOL_MAP.get(code, code)


def format_casting_time(time_field):
    if not time_field:
        return None
    parts = []
    for t in time_field:
        if isinstance(t, dict):
            num, unit = t.get("number"), t.get("unit")
            s = f"{num} {unit}" if num is not None and unit else (unit or "")
            cond = t.get("condition")
            if cond:
                s = f"{s}, {strip_tags(cond)}"
            parts.append(s.strip())
        else:
            parts.append(str(t))
    return " or ".join(p for p in parts if p) or None


def format_range(range_field):
    if not range_field:
        return None
    if isinstance(range_field, str):
        return range_field
    if not isinstance(range_field, dict):
        return None
    rtype = range_field.get("type")
    dist = range_field.get("distance") or {}
    dtype = dist.get("type")
    amount = dist.get("amount")
    if dtype in ("self", "touch", "unlimited", "sight"):
        label = dtype.capitalize()
    elif amount is not None and dtype:
        label = f"{amount} {dtype}"
    else:
        label = dtype or rtype or "Special"
    if rtype in ("radius", "sphere", "hemisphere", "cube", "cylinder"):
        return f"Self ({label} {rtype})"
    if rtype == "cone":
        return f"Self ({label} cone)"
    if rtype == "line":
        return f"Self ({label} line)"
    return label


def format_duration(duration_field):
    if not duration_field:
        return None, False
    parts, concentration = [], False
    for d in duration_field:
        if not isinstance(d, dict):
            continue
        if d.get("concentration"):
            concentration = True
        dtype = d.get("type")
        if dtype == "instant":
            parts.append("Instantaneous")
        elif dtype == "permanent":
            ends = d.get("ends") or []
            parts.append("Until dispelled" if "dispel" in ends else "Permanent")
        elif dtype == "special":
            parts.append("Special")
        elif dtype == "timed":
            dur = d.get("duration") or {}
            amt, unit = dur.get("amount"), dur.get("type")
            label = f"{amt} {unit}" + ("s" if amt and amt != 1 else "")
            prefix = "Up to " if d.get("concentration") else ""
            parts.append(f"{prefix}{label}")
        else:
            parts.append(dtype or "")
    text = " or ".join(p for p in parts if p) or None
    return text, concentration


def format_components_display(components):
    if not isinstance(components, dict):
        return None
    parts = []
    if components.get("v"):
        parts.append("V")
    if components.get("s"):
        parts.append("S")
    m = components.get("m")
    if m:
        text = m.get("text", "") if isinstance(m, dict) else str(m)
        parts.append(f"M ({text})" if text else "M")
    return ", ".join(parts) or None


def format_classes_display(classes):
    if not isinstance(classes, dict):
        return None
    names = []
    for c in classes.get("fromClassList") or []:
        if isinstance(c, dict) and c.get("name"):
            names.append(c["name"])
    seen = []
    for n in names:
        if n not in seen:
            seen.append(n)
    return ", ".join(seen) or None


def build_description(spell):
    parts = []
    e = flatten_entry(spell.get("entries"))
    if e:
        parts.append(e)
    ehl = flatten_entry(spell.get("entriesHigherLevel"))
    if ehl:
        parts.append(ehl)
    return "\n\n".join(parts) or None


def project_spell(cur, spell: dict, source_cache: dict):
    source_id = sources_mod.get_or_create_source(cur, source_cache, spell.get("source"))
    name = spell.get("name") or "(unnamed)"
    slug = slugify(name)
    duration_display, concentration = format_duration(spell.get("duration"))

    values = {
        "source_id": source_id,
        "campaign_id": None,
        "name": name,
        "slug": slug,
        "edition": None,
        "level": spell.get("level", 0),
        "school": format_school(spell.get("school")),
        "casting_time": format_casting_time(spell.get("time")),
        "range": format_range(spell.get("range")),
        "duration": duration_display,
        "concentration": bool(concentration),
        "ritual": bool((spell.get("meta") or {}).get("ritual")),
        "components_display": format_components_display(spell.get("components")),
        "components": json.dumps(spell["components"]) if "components" in spell else None,
        "classes_display": format_classes_display(spell.get("classes")),
        "classes": json.dumps(spell["classes"]) if "classes" in spell else None,
        "description": build_description(spell),
        "area": json.dumps({"areaTags": spell["areaTags"]}) if "areaTags" in spell else None,
        "damage": json.dumps({"damageInflict": spell["damageInflict"]}) if "damageInflict" in spell else None,
        "saving_throw": json.dumps({"savingThrow": spell["savingThrow"]}) if "savingThrow" in spell else None,
        "effects": json.dumps({"conditionInflict": spell["conditionInflict"]}) if "conditionInflict" in spell else None,
        "mechanics": json.dumps({k: spell[k] for k in ("miscTags", "scalingLevelDice") if k in spell}) or None,
        "raw_data": json.dumps(spell),
    }

    spell_id, was_insert = db_mod.upsert(
        cur, "spells", ["slug", "source_id"], values, conflict_where="source_id IS NOT NULL"
    )
    return spell_id, was_insert
