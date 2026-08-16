"""Stage 4 (creature) + Stage 6 (creature_actions). Field mapping per
data_normalisation_plan.txt section 4.1. Thin translation layer only -
anything not explicitly listed there stays in raw_data, never interpreted.
"""
import json
import re

from .. import db as db_mod
from .. import sources as sources_mod
from ..hashing import slugify
from ..text import flatten_entry, strip_tags

SIZE_MAP = {
    "F": "Fine", "D": "Diminutive", "T": "Tiny", "S": "Small", "M": "Medium",
    "L": "Large", "H": "Huge", "G": "Gargantuan", "C": "Colossal", "V": "Varies",
}
ALIGN_MAP = {
    "L": "Lawful", "N": "Neutral", "C": "Chaotic", "G": "Good", "E": "Evil",
    "U": "Unaligned", "A": "Any Alignment",
}
SKILL_DISPLAY = {
    "acrobatics": "Acrobatics", "animalHandling": "Animal Handling", "arcana": "Arcana",
    "athletics": "Athletics", "deception": "Deception", "history": "History",
    "insight": "Insight", "intimidation": "Intimidation", "investigation": "Investigation",
    "medicine": "Medicine", "nature": "Nature", "perception": "Perception",
    "performance": "Performance", "persuasion": "Persuasion", "religion": "Religion",
    "sleightOfHand": "Sleight of Hand", "stealth": "Stealth", "survival": "Survival",
}
SAVE_ABILITY_MAP = {
    "strength": "str", "dexterity": "dex", "constitution": "con",
    "intelligence": "int", "wisdom": "wis", "charisma": "cha",
}
CR_FRACTIONS = {"1/8": 0.125, "1/4": 0.25, "1/2": 0.5}

RECHARGE_TAG_RE = re.compile(r"\{@recharge ?(\d)?\}")
RECHARGE_TEXT_RE = re.compile(r"\(Recharge (\d+(?:[-–]\d+)?)\)", re.IGNORECASE)
USES_RE = re.compile(r"\((\d+/[A-Za-z][A-Za-z ]*)\)")
ATTACK_BONUS_RE = re.compile(r"\{@hit (-?\d+)\}")
REACH_RE = re.compile(r"reach (\d+)\s*ft", re.IGNORECASE)
RANGE_PAIR_RE = re.compile(r"range (\d+)/(\d+)\s*ft", re.IGNORECASE)
RANGE_SINGLE_RE = re.compile(r"range (\d+)\s*ft", re.IGNORECASE)
DAMAGE_RE = re.compile(r"\{@damage ([^}]+)\}\)?\s+([a-zA-Z]+)\s+damage")
DC_RE = re.compile(r"\{@dc (\d+)\}")
SAVE_RE = re.compile(
    r"(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw", re.IGNORECASE
)
ACTSAVE_TAG_RE = re.compile(r"\{@actSave (\w+)\}")

ACTION_TYPE_FIELDS = (
    ("trait", "trait"),
    ("action", "action"),
    ("bonus_action", "bonus"),
    ("reaction", "reaction"),
    ("legendary", "legendary"),
    ("mythic", "mythic"),
)

CREATURE_ACTION_COLUMNS = [
    "creature_id", "name", "action_type", "sort_order", "description",
    "attack_bonus", "reach", "range_normal", "range_long", "damage_formula",
    "damage_type", "save_ability", "save_dc", "recharge", "uses_text",
    "area", "mechanics", "raw_data",
]


def parse_size(size_field):
    if not size_field:
        return None
    codes = size_field if isinstance(size_field, list) else [size_field]
    words = [SIZE_MAP.get(c, c) for c in codes if isinstance(c, str)]
    return "/".join(words) if words else None


def parse_type(type_field):
    if type_field is None:
        return None, None
    if isinstance(type_field, str):
        return type_field, None
    if isinstance(type_field, dict):
        base = type_field.get("type")
        if isinstance(base, dict):
            base = base.get("choose", [None])
            base = base[0] if isinstance(base, list) and base else None
        tags = type_field.get("tags") or []
        tag_strs = [t if isinstance(t, str) else t.get("tag", "") for t in tags]
        subtype = ", ".join(t for t in tag_strs if t) or None
        return base, subtype
    return None, None


def format_alignment(align_field):
    if align_field is None:
        return None
    if isinstance(align_field, str):
        return align_field
    if isinstance(align_field, list):
        if all(isinstance(a, str) for a in align_field):
            # 5etools has an undocumented shorthand for "alternate alignment
            # pairs" using suffixed codes like "NX"/"NY" (seen on "any race"
            # NPCs, e.g. Bandit Captain: ["NX","C","G","NY","E"]) that isn't
            # a simple per-code word mapping. Rather than guess at a
            # half-translated rendering, only produce a display string when
            # every code is a plain recognized letter - raw_data always has
            # the untouched original either way.
            if not all(a in ALIGN_MAP for a in align_field):
                return None
            words = [ALIGN_MAP[a] for a in align_field]
            seen = []
            for w in words:
                if w not in seen:
                    seen.append(w)
            return " ".join(seen) or None
        parts = []
        for a in align_field:
            if isinstance(a, dict):
                if "special" in a:
                    parts.append(strip_tags(a["special"]))
                elif "alignment" in a:
                    parts.append(format_alignment(a["alignment"]))
        parts = [p for p in parts if p]
        return " or ".join(parts) if parts else None
    return None


def parse_ac(ac_field):
    if ac_field is None:
        return None
    if isinstance(ac_field, (int, float)):
        return int(ac_field)
    if isinstance(ac_field, list) and ac_field:
        first = ac_field[0]
        if isinstance(first, (int, float)):
            return int(first)
        if isinstance(first, dict) and isinstance(first.get("ac"), (int, float)):
            return int(first["ac"])
    return None


def parse_cr(cr_field):
    if cr_field is None:
        return None, None
    cr_val = cr_field.get("cr") if isinstance(cr_field, dict) else cr_field
    if cr_val is None:
        return None, None
    display = str(cr_val)
    if display in CR_FRACTIONS:
        return display, CR_FRACTIONS[display]
    try:
        return display, float(display)
    except ValueError:
        return display, None


def format_skills(skill_field):
    if not isinstance(skill_field, dict):
        return None
    parts = []
    for k, v in skill_field.items():
        if k == "other" or not isinstance(v, str):
            continue
        label = SKILL_DISPLAY.get(k, k)
        parts.append(f"{label} {v}")
    return ", ".join(parts) or None


def format_senses(senses_field):
    if not senses_field:
        return None
    if isinstance(senses_field, list):
        return ", ".join(str(s) for s in senses_field) or None
    return str(senses_field)


def format_languages(languages_field):
    if not languages_field:
        return None
    if isinstance(languages_field, list):
        return ", ".join(str(l) for l in languages_field) or None
    return str(languages_field)


def build_traits_summary(traits_field):
    if not traits_field:
        return None
    parts = []
    for t in traits_field:
        if not isinstance(t, dict):
            continue
        name = t.get("name")
        body = flatten_entry(t.get("entries"))
        parts.append(f"{strip_tags(name)}. {body}" if name else body)
    text = "\n\n".join(p for p in parts if p)
    return text or None


def _raw_join(obj):
    if obj is None:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, list):
        return " ".join(_raw_join(o) for o in obj)
    if isinstance(obj, dict):
        parts = []
        if "name" in obj:
            parts.append(str(obj["name"]))
        for key in ("entries", "entry", "items"):
            if key in obj:
                parts.append(_raw_join(obj[key]))
        return " ".join(parts)
    return str(obj)


def extract_action_row(action_type: str, sort_order: int, item: dict) -> dict:
    name_raw = item.get("name", "") or ""
    recharge = None
    m = RECHARGE_TAG_RE.search(name_raw)
    if m:
        digit = m.group(1)
        recharge = f"{digit}-6" if digit and digit != "6" else "6"
    else:
        m = RECHARGE_TEXT_RE.search(name_raw)
        if m:
            recharge = m.group(1)
    uses_text = None
    m = USES_RE.search(name_raw)
    if m:
        uses_text = m.group(1)

    raw_text = _raw_join(item.get("entries"))
    attack_bonus = None
    m = ATTACK_BONUS_RE.search(raw_text)
    if m:
        attack_bonus = int(m.group(1))
    reach = None
    m = REACH_RE.search(raw_text)
    if m:
        reach = int(m.group(1))
    range_normal = range_long = None
    m = RANGE_PAIR_RE.search(raw_text)
    if m:
        range_normal, range_long = int(m.group(1)), int(m.group(2))
    else:
        m = RANGE_SINGLE_RE.search(raw_text)
        if m:
            range_normal = int(m.group(1))
    damage_formula = damage_type = None
    m = DAMAGE_RE.search(raw_text)
    if m:
        damage_formula, damage_type = m.group(1).strip(), m.group(2).lower()
    save_dc = None
    m = DC_RE.search(raw_text)
    if m:
        save_dc = int(m.group(1))
    save_ability = None
    m = ACTSAVE_TAG_RE.search(raw_text)
    if m and m.group(1).lower() in SAVE_ABILITY_MAP.values():
        save_ability = m.group(1).lower()
    else:
        m = SAVE_RE.search(raw_text)
        if m:
            save_ability = SAVE_ABILITY_MAP.get(m.group(1).lower())

    return {
        "name": strip_tags(name_raw) or "(unnamed)",
        "action_type": action_type,
        "sort_order": sort_order,
        "description": flatten_entry(item.get("entries")),
        "attack_bonus": attack_bonus,
        "reach": reach,
        "range_normal": range_normal,
        "range_long": range_long,
        "damage_formula": damage_formula,
        "damage_type": damage_type,
        "save_ability": save_ability,
        "save_dc": save_dc,
        "recharge": recharge,
        "uses_text": uses_text,
        "area": None,
        "mechanics": None,
        "raw_data": json.dumps(item),
    }


def project_creature(cur, resolved: dict, source_cache: dict):
    """Upserts one `creatures` row + its `creature_actions` rows. Returns
    the creature's UUID."""
    source_abbr = resolved.get("source")
    source_id = sources_mod.get_or_create_source(cur, source_cache, source_abbr)
    name = resolved.get("name") or "(unnamed)"
    slug = slugify(name)

    creature_type, creature_subtype = parse_type(resolved.get("type"))
    hp = resolved.get("hp") or {}
    cr_display, cr_numeric = parse_cr(resolved.get("cr"))
    passive = resolved.get("passive")
    try:
        passive = int(passive)
    except (TypeError, ValueError):
        passive = None

    values = {
        "source_id": source_id,
        "campaign_id": None,
        "category": "monster",
        "name": name,
        "slug": slug,
        "edition": None,
        "creature_type": creature_type,
        "creature_subtype": creature_subtype,
        "size": parse_size(resolved.get("size")),
        "alignment": format_alignment(resolved.get("alignment")),
        "challenge_rating": cr_numeric,
        "challenge_rating_display": cr_display,
        "proficiency_bonus": None,
        "armor_class": parse_ac(resolved.get("ac")),
        "hit_points": hp.get("average"),
        "hit_dice": hp.get("formula"),
        "strength": resolved.get("str"),
        "dexterity": resolved.get("dex"),
        "constitution": resolved.get("con"),
        "intelligence": resolved.get("int"),
        "wisdom": resolved.get("wis"),
        "charisma": resolved.get("cha"),
        "skills": format_skills(resolved.get("skill")),
        "senses": format_senses(resolved.get("senses")),
        "passive_perception": passive,
        "languages": format_languages(resolved.get("languages")),
        "traits": build_traits_summary(resolved.get("trait")),
        "description": None,
        "relation": None,
        "importance": None,
        "profession": None,
        "level": None,
        "character_class": None,
        "motivations": None,
        "pitfalls": None,
        "history": None,
        "portrait_asset_id": None,
        "token_asset_id": None,
        "default_size": 1,
        "current_size": 1,
        "raw_data": json.dumps(resolved),
    }

    creature_id, was_insert = db_mod.upsert(
        cur, "creatures", ["slug", "source_id"], values, conflict_where="source_id IS NOT NULL"
    )

    db_mod.delete_where(cur, "creature_actions", "creature_id", creature_id)
    rows = []
    order = 0
    for action_type, field in ACTION_TYPE_FIELDS:
        for item in resolved.get(field) or []:
            if not isinstance(item, dict):
                continue
            row = extract_action_row(action_type, order, item)
            row["creature_id"] = creature_id
            rows.append(row)
            order += 1
    db_mod.insert_child_rows(cur, "creature_actions", rows, CREATURE_ACTION_COLUMNS)

    return creature_id, was_insert
