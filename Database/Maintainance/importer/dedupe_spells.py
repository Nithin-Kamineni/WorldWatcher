"""Post-Stage-4/5 cleanup for Bugs.txt #2b/#2c/#2h: the same spell name can
appear once per source book it's printed in (e.g. Fireball in both the 2014
and 2024 Player's Handbook) - keep only the most recently published version,
carrying over an image/classes from a superseded duplicate if the keeper
itself doesn't have one yet, then backfill `classes`/`classes_display` from
the SRD 5.2 spells JSON for anything still missing it (name-matched only -
per the user's instruction this never inserts new spell rows).

Deliberately destructive (deletes the superseded duplicate rows) but fully
reversible: the whole `spells` table is regenerated from
Database/external-data/5etools-src by re-running the importer from scratch,
same as any other stage here.
"""
import json


def dedupe_spells(cur, report):
    """For each spell name with more than one row, keep the row from the
    source with the latest `sources.publication_date` (NULLs sort as
    oldest); before deleting the rest, COALESCE the keeper's image_asset_id
    and classes/classes_display from any superseded duplicate that has one.
    """
    cur.execute(
        """
        SELECT s.id, s.name, s.image_asset_id, s.classes_display
        FROM spells s
        JOIN sources src ON src.id = s.source_id
        ORDER BY s.name, src.publication_date DESC NULLS LAST, s.id
        """
    )
    rows = cur.fetchall()

    groups: dict[str, list[tuple]] = {}
    for spell_id, name, image_asset_id, classes_display in rows:
        groups.setdefault(name, []).append((spell_id, image_asset_id, classes_display))

    kept = 0
    deleted = 0
    images_backfilled = 0
    classes_backfilled = 0

    for name, entries in groups.items():
        if len(entries) <= 1:
            kept += 1
            continue

        keeper_id, keeper_image, keeper_classes = entries[0]
        duplicate_ids = [e[0] for e in entries[1:]]

        fill_image = keeper_image
        fill_classes = keeper_classes
        if fill_image is None:
            for _id, image_asset_id, _classes in entries[1:]:
                if image_asset_id is not None:
                    fill_image = image_asset_id
                    break
        if not fill_classes:
            for _id, _image, classes_display in entries[1:]:
                if classes_display:
                    fill_classes = classes_display
                    break

        if fill_image != keeper_image or fill_classes != keeper_classes:
            cur.execute(
                "UPDATE spells SET image_asset_id = COALESCE(%s, image_asset_id) WHERE id = %s",
                (fill_image, keeper_id),
            )
            if fill_classes and not keeper_classes:
                cur.execute("UPDATE spells SET classes_display = %s WHERE id = %s", (fill_classes, keeper_id))
            if fill_image is not None and keeper_image is None:
                images_backfilled += 1
                report.record_asset("spell_dedupe_image_backfilled")
            if fill_classes and not keeper_classes:
                classes_backfilled += 1
                report.record_asset("spell_dedupe_classes_backfilled_from_dupe")

        cur.execute("DELETE FROM spells WHERE id = ANY(%s::uuid[])", (duplicate_ids,))
        deleted += len(duplicate_ids)
        kept += 1
        for _ in duplicate_ids:
            report.record_asset("spell_dedupe_deleted")
        report.record_asset("spell_dedupe_kept")

    return kept, deleted


def _srd_class_index(srd_path: str) -> dict[str, list[str]]:
    with open(srd_path, "r", encoding="utf-8") as f:
        srd_spells = json.load(f)
    index: dict[str, list[str]] = {}
    for entry in srd_spells:
        name = (entry.get("name") or "").strip()
        if not name:
            continue
        classes = entry.get("classes") or []
        index[name.lower()] = sorted({str(c).strip().title() for c in classes if str(c).strip()})
    return index


def backfill_spell_classes(cur, srd_path: str, report):
    """Fills classes/classes_display from the SRD 5.2 JSON for spells that
    still have none after dedupe - name-matched only, never inserts rows."""
    index = _srd_class_index(srd_path)

    cur.execute("SELECT id, name FROM spells WHERE classes_display IS NULL OR classes_display = ''")
    candidates = cur.fetchall()

    filled = 0
    for spell_id, name in candidates:
        classes = index.get((name or "").strip().lower())
        if not classes:
            continue
        cur.execute(
            "UPDATE spells SET classes_display = %s, classes = %s WHERE id = %s",
            (", ".join(classes), json.dumps(classes), spell_id),
        )
        filled += 1
        report.record_asset("spell_classes_backfilled_from_srd")

    return filled
