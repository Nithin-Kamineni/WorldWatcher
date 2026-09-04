"""Read-only integrity and coverage audit for the random-table subsystem."""
from __future__ import annotations

import asyncio
import os

import asyncpg


async def audit(conn: asyncpg.Connection) -> dict[str, int]:
    row = await conn.fetchrow(
        """
        SELECT
          (SELECT count(*) FROM random_tables) AS tables,
          (SELECT count(*) FROM table_columns) AS columns,
          (SELECT count(*) FROM table_entries) AS entries,
          (SELECT count(*) FROM generators) AS generators,
          (SELECT count(*) FROM random_tables r WHERE NOT EXISTS
             (SELECT 1 FROM table_columns c WHERE c.table_id=r.id)) AS empty_tables,
          (SELECT count(*) FROM table_columns c WHERE NOT EXISTS
             (SELECT 1 FROM table_entries e WHERE e.column_id=c.id)) AS empty_columns,
          (SELECT count(*) FROM table_entries
             WHERE kind='text' AND (text IS NULL OR btrim(text)='')) AS blank_text_entries,
          (SELECT count(*) FROM table_entries
             WHERE min IS NOT NULL AND max IS NOT NULL AND min > max) AS reversed_ranges,
          (SELECT count(*) FROM table_columns
             WHERE die_count < 1 OR die_sides < 0) AS invalid_dice,
          (SELECT count(*) FROM random_tables
             WHERE name LIKE '%â€%' OR description LIKE '%â€%') AS mojibake_tables,
          (SELECT count(*) FROM table_entries WHERE
             (kind='encounter_ref' AND encounter_id IS NULL) OR
             (kind='table_ref' AND target_table_id IS NULL) OR
             (kind='creature_ref' AND creature_id IS NULL) OR
             (kind='npc_ref' AND npc_id IS NULL) OR
             (kind='item_ref' AND item_id IS NULL)) AS broken_references,
          (SELECT count(*) FROM generators g WHERE g.slug=ANY(ARRAY[
             'npc-builder','country-builder','settlement-builder','building-builder','dungeon-builder',
             'combat-encounter-builder','social-encounter-builder','exploration-encounter-builder'])) AS builder_generators,
          (SELECT count(*) FROM random_tables WHERE source_book='WorldWatcher DM Toolkit (Original)') AS toolkit_tables,
          (SELECT count(*) FROM table_entries e JOIN table_columns c ON c.id=e.column_id
             JOIN random_tables r ON r.id=c.table_id
             WHERE r.source_book IN ('WorldWatcher DM Toolkit (Original)','D&D 5.1 SRD (CC BY 4.0)')) AS toolkit_entries
          ,(SELECT count(*) FROM table_entries e JOIN table_columns c ON c.id=e.column_id
             JOIN random_tables r ON r.id=c.table_id WHERE r.source_book='WorldWatcher NPC Builder') AS npc_builder_entries
          ,(SELECT count(*) FROM table_entries e JOIN table_columns c ON c.id=e.column_id
             JOIN random_tables r ON r.id=c.table_id WHERE r.source_book='WorldWatcher Place Builder') AS place_builder_entries
          ,(SELECT count(*) FROM table_entries e JOIN table_columns c ON c.id=e.column_id
             JOIN random_tables r ON r.id=c.table_id WHERE r.source_book='WorldWatcher Encounter Builder') AS encounter_builder_entries
        """
    )
    result = dict(row)

    # A valid one-die lookup with explicit ranges should cover every face once.
    result["lookup_columns_with_gaps_or_overlaps"] = await conn.fetchval(
        """
        WITH ranged AS (
          SELECT c.id, c.die_sides, min(e.min) AS low, max(e.max) AS high,
                 sum(e.max - e.min + 1) AS coverage
          FROM table_columns c
          JOIN table_entries e ON e.column_id=c.id
          JOIN random_tables r ON r.id=c.table_id
          JOIN table_formats f ON f.id=r.format_id
          WHERE f.slug IN ('lookup','reference','scene_generator','generator','cascading','bundle')
            AND c.die_count=1 AND c.die_sides>0
            AND e.min IS NOT NULL AND e.max IS NOT NULL
          GROUP BY c.id, c.die_sides
        )
        SELECT count(*) FROM ranged
        WHERE low<>1 OR high<>die_sides OR coverage<>die_sides
        """
    )
    return result


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"),
        port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"),
        user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    try:
        result = await audit(conn)
        for key, value in result.items():
            print(f"{key}: {value}")
        if result["reversed_ranges"]:
            rows = await conn.fetch(
                """SELECT r.name, r.source_book, c.name AS column_name, c.die_count,
                          c.die_sides, e.min, e.max, e.text
                   FROM table_entries e JOIN table_columns c ON c.id=e.column_id
                   JOIN random_tables r ON r.id=c.table_id
                   WHERE e.min IS NOT NULL AND e.max IS NOT NULL AND e.min>e.max
                   ORDER BY r.name, c.sort_order, e.sort_order"""
            )
            for row in rows:
                print("reversed:", dict(row))
        if result["lookup_columns_with_gaps_or_overlaps"]:
            rows = await conn.fetch(
                """WITH ranged AS (
                     SELECT c.id, r.name, r.source_book, c.name AS column_name, c.die_sides,
                            min(e.min) AS low, max(e.max) AS high,
                            sum(e.max-e.min+1) AS coverage
                     FROM table_columns c JOIN table_entries e ON e.column_id=c.id
                     JOIN random_tables r ON r.id=c.table_id JOIN table_formats f ON f.id=r.format_id
                     WHERE f.slug IN ('lookup','reference','scene_generator','generator','cascading','bundle')
                       AND c.die_count=1 AND c.die_sides>0 AND e.min IS NOT NULL AND e.max IS NOT NULL
                     GROUP BY c.id,r.name,r.source_book,c.name,c.die_sides)
                   SELECT name,source_book,column_name,die_sides,low,high,coverage FROM ranged
                   WHERE low<>1 OR high<>die_sides OR coverage<>die_sides
                   ORDER BY source_book,name,column_name LIMIT 100"""
            )
            for row in rows:
                print("coverage:", dict(row))
        # Coverage anomalies can be intentional (several alternate result sets share
        # ranges), so report them for review but fail only hard integrity defects.
        informational = {"tables", "columns", "entries", "generators", "builder_generators", "toolkit_tables", "toolkit_entries", "npc_builder_entries", "place_builder_entries", "encounter_builder_entries", "lookup_columns_with_gaps_or_overlaps"}
        failures = {key: value for key, value in result.items() if key not in informational and value}
        if failures:
            raise SystemExit(1)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
