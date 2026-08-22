"""One-off data-curation script (not an Alembic migration) for Bugs.txt's Factions
influence/importance batch.

Sets `factions.influence` and `faction_relations.importance` for the live sample data
seeded into "Meridian: A World in Constant Dawn" and "Eboron: The Last War" (both
campaigns carry an identical 8-faction/11-relation dataset).

Heuristic (reviewed against the actual campaign data before running):
- influence: top half of the campaign's 8 factions by `power` -> 'major', bottom half
  -> 'regional'. Constraint from the requirement ("all powers are above minor"): never
  assigns 'petty'/'local'/'minor' to this dataset. Power values (11,10,8,7 | 5,3,3,2)
  split cleanly into two tiers of 4 with no tie at the boundary.
- importance: relation `strength` >= 60 -> 'primary', else 'secondary'. Strength values
  (95,90,80,70,60 | 55,50,40,30,20,15) split cleanly at the same boundary - the top 5
  relations are exactly the ones connecting the top-tier ("major") factions to each
  other/to the next-strongest faction, which lines up with "primary" reading as
  narratively central to those factions.

Re-runnable: re-applies the same deterministic mapping every time, does not depend on
prior runs.
"""
import asyncio
import os

import asyncpg


async def main() -> None:
    conn = await asyncpg.connect(
        host=os.environ.get("WW_DB_HOST", "localhost"),
        port=int(os.environ.get("WW_DB_PORT", "5432")),
        database=os.environ.get("WW_DB_NAME", "WorldWatcher_DB"),
        user=os.environ.get("WW_DB_USER", "postgres"),
        password=os.environ.get("WW_DB_PASSWORD", ""),
    )
    try:
        campaign_ids = [r["campaign_id"] for r in await conn.fetch("SELECT DISTINCT campaign_id FROM factions")]
        for campaign_id in campaign_ids:
            factions = await conn.fetch(
                "SELECT id, name, power FROM factions WHERE campaign_id = $1 ORDER BY power DESC",
                campaign_id,
            )
            half = len(factions) // 2
            for i, f in enumerate(factions):
                influence = "major" if i < half else "regional"
                await conn.execute("UPDATE factions SET influence = $1 WHERE id = $2", influence, f["id"])
                print(f"  faction {f['name']!r} (power={f['power']}) -> influence={influence}")

            relations = await conn.fetch(
                "SELECT id, relation_type, strength FROM faction_relations WHERE campaign_id = $1",
                campaign_id,
            )
            for r in relations:
                importance = "primary" if r["strength"] >= 60 else "secondary"
                await conn.execute(
                    "UPDATE faction_relations SET importance = $1 WHERE id = $2", importance, r["id"]
                )
                print(f"  relation {r['relation_type']} strength={r['strength']} -> importance={importance}")
            print(f"campaign {campaign_id}: {len(factions)} factions, {len(relations)} relations updated")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
