"""Shared text helpers: flattening 5etools' `entries[]` structures and
stripping its `{@tag ...}` markup into plain, readable text for the
various *_display / description columns. This is a display convenience
only - the original structured entries always stay in raw_data too.
"""
import re

_TAG_RE = re.compile(r"\{@(\w+)([^}]*)\}")

_ABILITY_FULL = {
    "str": "Strength", "dex": "Dexterity", "con": "Constitution",
    "int": "Intelligence", "wis": "Wisdom", "cha": "Charisma",
}

_ATK_LABELS = {
    "mw": "Melee Weapon Attack:",
    "rw": "Ranged Weapon Attack:",
    "mw,rw": "Melee or Ranged Weapon Attack:",
    "rw,mw": "Melee or Ranged Weapon Attack:",
    "m": "Melee Attack:",
    "r": "Ranged Attack:",
    "ms": "Melee Spell Attack:",
    "rs": "Ranged Spell Attack:",
}


def _tag_replacer(match: "re.Match") -> str:
    tag = match.group(1)
    rest = match.group(2).strip()
    if tag == "h":
        return "Hit: "
    if tag == "atk":
        return _ATK_LABELS.get(rest.replace(" ", ""), "Attack:")
    if tag == "hit":
        val = rest.lstrip()
        sign = "+" if not val.startswith("-") else ""
        return f"{sign}{val}"
    if tag == "dc":
        return f"DC {rest.strip()}"
    if tag == "recharge":
        n = rest.strip()
        return f"(Recharge {n}-6)" if n and n != "6" else "(Recharge 6)"
    if tag == "actSave":
        ab = rest.strip().lower()
        return f"{_ABILITY_FULL.get(ab, ab.title())} saving throw"
    if tag == "actSaveFail":
        return "Failure:"
    if tag == "actSaveSuccess":
        return "Success:"
    if tag == "actSaveEach":
        return "Every creature makes a saving throw:"
    if tag in ("damage", "scaledamage", "dice", "d20", "scaledice"):
        first = rest.split("|")[0].strip()
        return first
    if not rest:
        return tag
    # Generic {@tag text|source|display} -> prefer the explicit display-text
    # override (3rd+ pipe segment) when 5etools provides one, else the raw
    # text (1st segment).
    parts = [p.strip() for p in rest.lstrip("|").split("|")]
    parts = [p for p in parts if p]
    if not parts:
        return tag
    return parts[-1] if len(parts) >= 3 else parts[0]


def strip_tags(s: str) -> str:
    if not isinstance(s, str):
        return s
    return _TAG_RE.sub(_tag_replacer, s)


def flatten_entry(entry, depth: int = 0) -> str:
    if entry is None:
        return ""
    if isinstance(entry, str):
        return strip_tags(entry)
    if isinstance(entry, list):
        return "\n".join(flatten_entry(e, depth) for e in entry if e is not None)
    if isinstance(entry, dict):
        etype = entry.get("type")
        parts = []
        name = entry.get("name")
        if name:
            parts.append(f"{strip_tags(name)}.")
        if etype == "list":
            items = entry.get("items", [])
            for it in items:
                if isinstance(it, dict):
                    it_name = it.get("name")
                    it_body = flatten_entry(it.get("entries") or it.get("entry"), depth + 1)
                    prefix = f"{strip_tags(it_name)}: " if it_name else ""
                    parts.append(f"- {prefix}{it_body}")
                else:
                    parts.append(f"- {flatten_entry(it, depth + 1)}")
        elif etype == "table":
            # Tables are structural; keep a lightweight text summary here
            # (the full table lives in raw_data untouched).
            caption = entry.get("caption")
            if caption:
                parts.append(strip_tags(caption))
            parts.append("[table - see raw_data]")
        elif "entries" in entry:
            parts.append(flatten_entry(entry["entries"], depth + 1))
        elif "entry" in entry:
            parts.append(flatten_entry(entry["entry"], depth + 1))
        elif "items" in entry:
            parts.append(flatten_entry(entry["items"], depth + 1))
        return "\n".join(p for p in parts if p)
    return str(entry)


def flatten_entries(entries) -> str:
    if not entries:
        return None
    text = flatten_entry(entries)
    return text or None
