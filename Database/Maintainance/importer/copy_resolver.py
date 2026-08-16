"""Stage 3: resolve 5etools' `_copy` / `_versions` mechanism in-memory,
before any DB write. Targets creatures primarily (the only type this
importer projects that uses `_copy` heavily).

Per data_normalisation_plan.txt section 6: implement the array-mod
operators actually observed in real bestiary data (see the docstring on
RECOGNIZED_MODES below). Anything else -> log + raw-only-ingest for that
one entity, never crash, never guess.
"""
import copy as copy_mod
import re

# Modes this resolver knows how to apply to _mod array fields (trait/
# action/bonus/reaction/legendary/mythic). Anything else is unsupported.
RECOGNIZED_ARRAY_MODES = {
    "prependArr",
    "appendArr",
    "appendIfNotExistsArr",
    "insertArr",
    "removeArr",
    "replaceArr",
}
# Modes recognized but not applied to arrays (whole-field operations).
RECOGNIZED_SCALAR_MODES = {"setProp", "replaceTxt"}
# Modes 5etools uses for the spellcasting block. Spellcasting stays in
# raw_data only (never projected to columns - see database_scehma.txt
# section 5), so these are accepted but applied with a best-effort merge
# rather than full 5etools semantics.
RECOGNIZED_SPELL_MODES = {"addSpells", "removeSpells", "replaceSpells", "addSkills"}

ALL_RECOGNIZED_MODES = RECOGNIZED_ARRAY_MODES | RECOGNIZED_SCALAR_MODES | RECOGNIZED_SPELL_MODES


class UnsupportedCopyMod(Exception):
    def __init__(self, mode):
        super().__init__(f"unrecognized _copy _mod mode: {mode}")
        self.mode = mode


class CopyCycle(Exception):
    pass


def _item_matches(item, matcher):
    """5etools array-mod matchers are usually {'name': <regex>} applied
    against the array item's `name` field."""
    if not isinstance(matcher, dict):
        return False
    name_pat = matcher.get("name")
    if name_pat is None:
        return False
    item_name = item.get("name", "") if isinstance(item, dict) else ""
    return re.search(name_pat, item_name) is not None


def _apply_array_mode(arr: list, mod: dict):
    mode = mod["mode"]
    if mode == "prependArr":
        items = mod["items"]
        items = items if isinstance(items, list) else [items]
        return items + arr
    if mode == "appendArr":
        items = mod["items"]
        items = items if isinstance(items, list) else [items]
        return arr + items
    if mode == "appendIfNotExistsArr":
        items = mod["items"]
        items = items if isinstance(items, list) else [items]
        existing_names = {i.get("name") for i in arr if isinstance(i, dict)}
        for it in items:
            if not (isinstance(it, dict) and it.get("name") in existing_names):
                arr = arr + [it]
        return arr
    if mode == "insertArr":
        items = mod["items"]
        items = items if isinstance(items, list) else [items]
        idx = mod.get("index", len(arr))
        return arr[:idx] + items + arr[idx:]
    if mode == "removeArr":
        names = mod.get("names")
        if names is not None:
            names = names if isinstance(names, list) else [names]
            return [i for i in arr if not (isinstance(i, dict) and i.get("name") in names)]
        matcher = mod.get("items")
        return [i for i in arr if not _item_matches(i, {"name": matcher} if isinstance(matcher, str) else matcher)]
    if mode == "replaceArr":
        replace_pat = mod.get("replace")
        items = mod["items"]
        items = items if isinstance(items, list) else [items]
        out = []
        replaced = False
        for i in arr:
            if isinstance(i, dict) and replace_pat and re.search(replace_pat, i.get("name", "")):
                out.extend(items)
                replaced = True
            else:
                out.append(i)
        if not replaced:
            out.extend(items)
        return out
    raise UnsupportedCopyMod(mode)


def _replace_txt_recursive(obj, pattern, repl):
    if isinstance(obj, str):
        return re.sub(pattern, repl, obj)
    if isinstance(obj, list):
        return [_replace_txt_recursive(v, pattern, repl) for v in obj]
    if isinstance(obj, dict):
        return {k: _replace_txt_recursive(v, pattern, repl) for k, v in obj.items()}
    return obj


def apply_mod(resolved: dict, mod_map: dict):
    """Apply a `_copy._mod` map to `resolved` in place. Raises
    UnsupportedCopyMod if it contains an operator this resolver doesn't
    implement."""
    for field, mod in mod_map.items():
        if field == "*":
            # Whole-object operation (currently only replaceTxt observed).
            entries = mod if isinstance(mod, list) else [mod]
            for m in entries:
                mode = m.get("mode")
                if mode != "replaceTxt":
                    raise UnsupportedCopyMod(mode)
                pattern = m["replace"]
                repl = m["with"]
                for k, v in list(resolved.items()):
                    resolved[k] = _replace_txt_recursive(v, pattern, repl)
            continue

        if isinstance(mod, dict) and "mode" in mod:
            mode = mod["mode"]
            if mode in RECOGNIZED_SPELL_MODES:
                # Best-effort: leave spellcasting block as-is from the base
                # entity: it is raw_data-only content, and 5etools' spell
                # mod semantics are involved enough that a wrong guess is
                # worse than an unmodified (but still present) block.
                continue
            if mode == "setProp":
                resolved[field] = mod.get("value")
                continue
            current = resolved.get(field, [])
            if not isinstance(current, list):
                raise UnsupportedCopyMod(mode)
            resolved[field] = _apply_array_mode(current, mod)
        elif isinstance(mod, list):
            for m in mod:
                mode = m.get("mode") if isinstance(m, dict) else None
                if mode in RECOGNIZED_SPELL_MODES:
                    continue
                if mode == "setProp":
                    resolved[field] = m.get("value")
                    continue
                current = resolved.get(field, [])
                if not isinstance(current, list):
                    raise UnsupportedCopyMod(mode)
                resolved[field] = _apply_array_mode(current, m)
        else:
            # Plain scalar/object overwrite.
            resolved[field] = mod


def resolve_entity(entity: dict, index: dict, memo: dict, in_progress=None):
    """Resolve a single entity's `_copy` chain (recursive, memoized, cycle-
    detected). `index` maps (name, source) -> raw entity dict. Returns the
    fully resolved object (a NEW dict; `entity` itself is never mutated).

    Raises UnsupportedCopyMod / CopyCycle / KeyError (base not found) on
    failure - caller must catch and fall back to raw-only ingest for this
    one entity.
    """
    if "_copy" not in entity:
        return entity

    key = (entity.get("name"), entity.get("source"))
    if key in memo:
        return memo[key]

    in_progress = in_progress or set()
    if key in in_progress:
        raise CopyCycle(f"_copy cycle detected at {key}")
    in_progress = in_progress | {key}

    cp = entity["_copy"]
    base_key = (cp.get("name"), cp.get("source"))
    base = index.get(_index_key(*base_key))
    if base is None:
        raise KeyError(f"_copy base not found: {base_key}")

    base_resolved = resolve_entity(base, index, memo, in_progress)
    resolved = copy_mod.deepcopy(base_resolved)

    # The copying entity's own top-level scalar fields (name/source/page/
    # etc, anything not `_copy` itself) override the base first.
    for k, v in entity.items():
        if k == "_copy":
            continue
        resolved[k] = v

    if "_mod" in cp:
        apply_mod(resolved, cp["_mod"])

    memo[key] = resolved
    return resolved


def expand_versions(resolved: dict):
    """If `resolved` (or its original unresolved form) carries `_versions`,
    expand into N standalone objects, each with its own source_key
    discriminator. Returns a list of (object, source_key_suffix)."""
    versions = resolved.get("_versions")
    if not versions:
        return [(resolved, None)]

    out = []
    for v in versions:
        merged = copy_mod.deepcopy(resolved)
        merged.pop("_versions", None)
        if "_mod" in v:
            mod = v.pop("_mod")
            for k, val in v.items():
                merged[k] = val
            apply_mod(merged, mod)
        else:
            for k, val in v.items():
                merged[k] = val
        suffix = merged.get("name", "").lower()
        out.append((merged, suffix))
    return out


def _index_key(name, source):
    # 5etools' own data isn't always internally consistent about name
    # casing between a _copy reference and the base entity it points at
    # (e.g. Ougalop's _copy references "Kuo-Toa" while the actual MM
    # entity is named "Kuo-toa") - normalize case for lookups only, never
    # for display/slug, since a false-positive collision across two
    # differently-cased names in the same source is not realistically
    # going to happen in this dataset.
    return (name.lower() if isinstance(name, str) else name, source)


def build_index(entities):
    """entities: iterable of raw dicts (same type, e.g. all monsters across
    all bestiary files). Returns {(name.lower(), source): entity}."""
    index = {}
    for e in entities:
        index[_index_key(e.get("name"), e.get("source"))] = e
    return index
