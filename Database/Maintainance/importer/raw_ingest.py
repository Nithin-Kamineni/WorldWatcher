"""Stage 2: lossless raw ingest, always, for everything discovery finds -
regardless of whether it will be relationally projected. This stage alone
guarantees losslessness even if every later stage is buggy or incomplete.
"""
import json

from . import db as db_mod
from .hashing import content_hash, slugify

OUTCOME_INSERTED = "inserted"
OUTCOME_UPDATED = "updated"
OUTCOME_UNCHANGED = "unchanged"


def make_source_key(entity: dict, top_level_key: str, fallback_index: int) -> str:
    name = entity.get("name")
    source = entity.get("source")
    if name and source:
        return f"{slugify(name)}|{str(source).lower()}"
    if name:
        return f"{slugify(name)}|unknown-source"
    # No name at all (rare lookup-table rows) - key by key+index, still
    # deterministic across runs as long as file ordering is stable.
    return f"{top_level_key}#{fallback_index}"


def upsert_raw_entity(cur, *, source: str, source_file: str, source_key: str,
                       entity_type: str, raw_data: dict):
    h = content_hash(raw_data)

    cur.execute(
        "SELECT id, content_hash, linked_table, linked_id FROM raw_entities "
        "WHERE source_file = %s AND source_key = %s",
        (source_file, source_key),
    )
    row = cur.fetchone()

    if row is None:
        cur.execute(
            """
            INSERT INTO raw_entities
                (source, source_file, source_key, entity_type, raw_data,
                 content_hash, import_status)
            VALUES (%s, %s, %s, %s, %s, %s, 'raw_only')
            RETURNING id
            """,
            (source, source_file, source_key, entity_type, json.dumps(raw_data), h),
        )
        new_id = cur.fetchone()[0]
        return new_id, OUTCOME_INSERTED, None, None

    existing_id, existing_hash, linked_table, linked_id = row
    if existing_hash == h:
        return existing_id, OUTCOME_UNCHANGED, linked_table, linked_id

    cur.execute(
        """
        UPDATE raw_entities
        SET source = %s, entity_type = %s, raw_data = %s, content_hash = %s
        WHERE id = %s
        """,
        (source, entity_type, json.dumps(raw_data), h, existing_id),
    )
    return existing_id, OUTCOME_UPDATED, linked_table, linked_id


def mark_projected(cur, raw_entity_id, linked_table: str, linked_id):
    cur.execute(
        "UPDATE raw_entities SET linked_table = %s, linked_id = %s, import_status = 'projected' WHERE id = %s",
        (linked_table, linked_id, raw_entity_id),
    )


def mark_error(cur, raw_entity_id):
    cur.execute(
        "UPDATE raw_entities SET import_status = 'error' WHERE id = %s",
        (raw_entity_id,),
    )
