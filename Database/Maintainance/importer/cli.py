"""Entry point. Wires together every stage described in
data_normalisation_plan.txt section 2:

  Stage 0 Discover -> Stage 1 Sources -> Stage 2 Raw ingest (always) ->
  Stage 3 Resolve (_copy/_versions, creatures) -> Stage 4 Project
  (creature/spell/item/condition) -> Stage 5 Assets -> Stage 6 Creature
  sub-entities (folded into Stage 4 for creatures) -> Stage 7 Report.
"""
import argparse
import os
import sys
import time
from collections import defaultdict
from urllib.parse import urlparse

from . import assets as assets_mod
from . import copy_resolver
from . import db as db_mod
from . import dedupe_spells as dedupe_spells_mod
from . import discovery
from . import raw_ingest
from . import sources as sources_mod
from .config import Config
from .projectors.bastion_facility import project_bastion_facility
from .projectors.condition import project_condition
from .projectors.creature import project_creature
from .projectors.encounter import project_encounter
from .projectors.item import project_item
from .projectors.spell import project_spell
from .report import Report

CONDITION_LIKE_TYPES = ("condition", "disease", "status")
PROJECTABLE_TYPES = ("creature", "spell", "item", "encounter", "facility") + CONDITION_LIKE_TYPES

COMMIT_EVERY = 500


def parse_args(argv=None) -> Config:
    p = argparse.ArgumentParser(description="WorldWatcher 5etools importer")
    p.add_argument("--data-dir", default=None, help="path to the 5etools-src data/ checkout")
    p.add_argument("--img-dir", default=None, help="path to the 5etools-img checkout")
    p.add_argument("--asset-output", default=None, help="where to copy matched images to")
    p.add_argument("--srd-spells-path", default=None, help="path to srd-5.2-spells.json, used only to backfill spell classes")
    p.add_argument("--db-url", default=None, help="postgres://user:pass@host:port/dbname")
    p.add_argument("--db-host", default=None)
    p.add_argument("--db-port", type=int, default=None)
    p.add_argument("--db-name", default=None)
    p.add_argument("--db-user", default=None)
    p.add_argument("--db-password", default=None)
    p.add_argument("--only-types", default=None, help="comma list: creature,spell,item,condition")
    p.add_argument("--only-sources", default=None, help="comma list of source abbreviations, e.g. MM,XPHB")
    p.add_argument("--allow-list", default=None, help="comma list of exact entity names")
    p.add_argument("--allow-list-file", default=None, help="file with one entity name per line")
    p.add_argument("--limit", type=int, default=0, help="cap projected entities per type (0 = no limit)")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--skip-assets", action="store_true")
    p.add_argument("--verbose", action="store_true")
    args = p.parse_args(argv)

    cfg = Config()
    if args.data_dir:
        cfg.data_dir = args.data_dir
    if args.img_dir:
        cfg.img_dir = args.img_dir
    if args.asset_output:
        cfg.asset_output = args.asset_output
    if args.srd_spells_path:
        cfg.srd_spells_path = args.srd_spells_path
    if args.db_url:
        u = urlparse(args.db_url)
        cfg.db_host = u.hostname or cfg.db_host
        cfg.db_port = u.port or cfg.db_port
        cfg.db_name = (u.path or "/").lstrip("/") or cfg.db_name
        cfg.db_user = u.username or cfg.db_user
        cfg.db_password = u.password or cfg.db_password
    if args.db_host:
        cfg.db_host = args.db_host
    if args.db_port:
        cfg.db_port = args.db_port
    if args.db_name:
        cfg.db_name = args.db_name
    if args.db_user:
        cfg.db_user = args.db_user
    if args.db_password is not None:
        cfg.db_password = args.db_password

    if args.only_types:
        cfg.only_types = tuple(t.strip() for t in args.only_types.split(",") if t.strip())
    if args.only_sources:
        cfg.only_sources = tuple(s.strip().upper() for s in args.only_sources.split(",") if s.strip())

    allow = []
    if args.allow_list:
        allow.extend(n.strip() for n in args.allow_list.split(",") if n.strip())
    if args.allow_list_file:
        with open(args.allow_list_file, "r", encoding="utf-8") as f:
            allow.extend(line.strip() for line in f if line.strip())
    if allow:
        cfg.allow_list = tuple(n.lower() for n in allow)

    cfg.limit = args.limit
    cfg.dry_run = args.dry_run
    cfg.skip_assets = args.skip_assets
    cfg.verbose = args.verbose
    return cfg


def passes_filter(cfg: Config, obj: dict) -> bool:
    if cfg.only_sources:
        if (obj.get("source") or "").upper() not in cfg.only_sources:
            return False
    if cfg.allow_list:
        if (obj.get("name") or "").lower() not in cfg.allow_list:
            return False
    return True


def type_wanted(cfg: Config, entity_type: str) -> bool:
    if not cfg.only_types:
        return True
    if entity_type in cfg.only_types:
        return True
    if entity_type in CONDITION_LIKE_TYPES and "condition" in cfg.only_types:
        return True
    return False


def discover_all(cfg: Config, report: Report):
    """Phase A: one walk over data/, classifying every file. Returns
    pending[entity_type] = [(source_file, top_level_key, obj, index), ...]
    and the flat list of every raw monster object (for the _copy index -
    built from the FULL unfiltered set so resolution never breaks just
    because --only-sources narrowed the projection set)."""
    pending = defaultdict(list)
    all_monsters_raw = []
    idx_counters = defaultdict(int)

    for path in discovery.walk_json_files(cfg.data_dir):
        rel = os.path.relpath(path, cfg.data_dir).replace(os.sep, "/")
        collections, err = discovery.classify_file(path)
        if err:
            report.record("__file__", "-", rel, "error", err)
            continue
        for entity_type, top_level_key, objs in collections:
            for obj in objs:
                idx = idx_counters[top_level_key]
                idx_counters[top_level_key] += 1
                if entity_type == "creature":
                    all_monsters_raw.append(obj)
                pending[entity_type].append((rel, top_level_key, obj, idx))

    return pending, all_monsters_raw


def stage2_raw_ingest(cur, cfg: Config, report: Report, pending: dict):
    """Stage 2: always runs for everything discovery found (subject only to
    --only-sources/--allow-list, which exist specifically to shrink the
    footprint of a smoke-test run - see cli.py module docstring)."""
    meta = {}
    n = 0
    for entity_type, items in pending.items():
        for source_file, top_level_key, obj, idx in items:
            if not passes_filter(cfg, obj):
                continue
            source_key = raw_ingest.make_source_key(obj, top_level_key, idx)
            source_abbr = obj.get("source") or "unknown"
            raw_id, outcome, linked_table, linked_id = raw_ingest.upsert_raw_entity(
                cur, source=source_abbr, source_file=source_file, source_key=source_key,
                entity_type=entity_type, raw_data=obj,
            )
            report.record_raw(entity_type, outcome)
            meta[(entity_type, source_file, source_key)] = (raw_id, outcome, linked_table, linked_id)
            n += 1
            if n % COMMIT_EVERY == 0:
                cur.connection.commit()
    cur.connection.commit()
    return meta


def stage4_creatures(cur, cfg: Config, report: Report, pending, meta, source_cache, creature_index, img_index):
    if not type_wanted(cfg, "creature"):
        return
    n = 0
    projected = 0
    for source_file, top_level_key, obj, idx in pending.get("creature", []):
        if not passes_filter(cfg, obj):
            continue
        if cfg.limit and projected >= cfg.limit:
            break
        name, source = obj.get("name", "?"), obj.get("source", "?")
        source_key = raw_ingest.make_source_key(obj, top_level_key, idx)
        raw_id, prev_outcome, linked_table, linked_id = meta[("creature", source_file, source_key)]

        if prev_outcome == "unchanged" and linked_table == "creatures":
            report.record("creature", source, name, "unchanged")
            projected += 1
            continue

        try:
            with db_mod.savepoint(cur, "rec"):
                try:
                    resolved = copy_resolver.resolve_entity(obj, creature_index, {})
                except copy_resolver.UnsupportedCopyMod as e:
                    report.record("creature", source, name, "unsupported", str(e))
                    raise
                except copy_resolver.CopyCycle as e:
                    report.record("creature", source, name, "malformed", str(e))
                    raise
                except KeyError as e:
                    report.record("creature", source, name, "malformed", f"copy base not found: {e}")
                    raise

                first_id = None
                for obj2, _suffix in copy_resolver.expand_versions(resolved):
                    if not obj2.get("name"):
                        continue
                    cid, was_insert = project_creature(cur, obj2, source_cache)
                    if first_id is None:
                        first_id = cid
                    report.record("creature", obj2.get("source", source), obj2.get("name"),
                                  "imported" if was_insert else "updated")

                if first_id is None:
                    raise ValueError("no name on resolved creature or any expanded version")

                raw_ingest.mark_projected(cur, raw_id, "creatures", first_id)

                if not cfg.skip_assets and img_index is not None:
                    result = assets_mod.link_creature_assets(
                        cur, img_index, cfg.asset_output, cfg.img_dir,
                        creature_id=first_id, source_abbr=source, name=name,
                        has_token=bool(obj.get("hasToken")), has_fluff_images=bool(obj.get("hasFluffImages")),
                    )
                    if result:
                        portrait_matched, token_matched = result
                        if portrait_matched:
                            report.record_asset("creature_portrait_matched")
                        if token_matched:
                            report.record_asset("creature_token_matched")
        except (copy_resolver.UnsupportedCopyMod, copy_resolver.CopyCycle, KeyError):
            pass  # already reported above
        except Exception as e:
            report.record("creature", source, name, "error", str(e))
            raw_ingest.mark_error(cur, raw_id)

        projected += 1
        n += 1
        if n % COMMIT_EVERY == 0:
            cur.connection.commit()
    cur.connection.commit()


def stage4_simple(cur, cfg: Config, report: Report, pending, meta, source_cache, entity_type: str, projector_fn):
    """Shared Stage 4 loop for spell/item (no _copy resolution needed)."""
    if not type_wanted(cfg, entity_type):
        return
    n = 0
    projected = 0
    table = {"spell": "spells", "item": "items", "encounter": "encounters", "facility": "bastion_facilities"}[entity_type]
    for source_file, top_level_key, obj, idx in pending.get(entity_type, []):
        if not passes_filter(cfg, obj):
            continue
        if cfg.limit and projected >= cfg.limit:
            break
        name, source = obj.get("name", "?"), obj.get("source", "?")
        source_key = raw_ingest.make_source_key(obj, top_level_key, idx)
        raw_id, prev_outcome, linked_table, linked_id = meta[(entity_type, source_file, source_key)]

        if prev_outcome == "unchanged" and linked_table == table:
            report.record(entity_type, source, name, "unchanged")
            projected += 1
            continue

        try:
            with db_mod.savepoint(cur, "rec"):
                row_id, was_insert = projector_fn(cur, obj, source_cache)
                raw_ingest.mark_projected(cur, raw_id, table, row_id)
                report.record(entity_type, source, name, "imported" if was_insert else "updated")
                # `meta` was snapshotted before Stage 4 ran (linked_table was
                # still NULL for anything newly projected this run) - update
                # it in place so any later stage reading `meta` in this same
                # run (e.g. stage5_item_assets) sees the fresh linkage
                # instead of a stale pre-projection view.
                meta[(entity_type, source_file, source_key)] = (raw_id, prev_outcome, table, row_id)
        except Exception as e:
            report.record(entity_type, source, name, "error", str(e))
            raw_ingest.mark_error(cur, raw_id)

        projected += 1
        n += 1
        if n % COMMIT_EVERY == 0:
            cur.connection.commit()
    cur.connection.commit()


def stage4_conditions(cur, cfg: Config, report: Report, pending, meta, source_cache):
    for entity_type in CONDITION_LIKE_TYPES:
        if not type_wanted(cfg, entity_type):
            continue
        n = 0
        projected = 0
        for source_file, top_level_key, obj, idx in pending.get(entity_type, []):
            if not passes_filter(cfg, obj):
                continue
            if cfg.limit and projected >= cfg.limit:
                break
            name, source = obj.get("name", "?"), obj.get("source", "?")
            source_key = raw_ingest.make_source_key(obj, top_level_key, idx)
            raw_id, prev_outcome, linked_table, linked_id = meta[(entity_type, source_file, source_key)]

            if prev_outcome == "unchanged" and linked_table == "conditions":
                report.record(entity_type, source, name, "unchanged")
                projected += 1
                continue

            try:
                with db_mod.savepoint(cur, "rec"):
                    row_id, was_insert = project_condition(cur, obj, entity_type, source_cache)
                    raw_ingest.mark_projected(cur, raw_id, "conditions", row_id)
                    report.record(entity_type, source, name, "imported" if was_insert else "updated")
            except Exception as e:
                report.record(entity_type, source, name, "error", str(e))
                raw_ingest.mark_error(cur, raw_id)

            projected += 1
            n += 1
            if n % COMMIT_EVERY == 0:
                cur.connection.commit()
        cur.connection.commit()


def stage5_item_assets(cur, cfg: Config, report: Report, pending, meta, img_index):
    if cfg.skip_assets or img_index is None or not type_wanted(cfg, "item"):
        return
    for source_file, top_level_key, obj, idx in pending.get("item", []):
        if not passes_filter(cfg, obj):
            continue
        name, source = obj.get("name", "?"), obj.get("source", "?")
        source_key = raw_ingest.make_source_key(obj, top_level_key, idx)
        raw_id, prev_outcome, linked_table, linked_id = meta[("item", source_file, source_key)]
        if linked_table != "items" or linked_id is None:
            continue
        try:
            with db_mod.savepoint(cur, "rec"):
                matched = assets_mod.link_item_asset(
                    cur, img_index, cfg.asset_output, cfg.img_dir,
                    item_id=linked_id, source_abbr=source, name=name,
                    has_fluff_images=bool(obj.get("hasFluffImages")),
                )
                if matched:
                    report.record_asset("item_image_matched")
        except Exception as e:
            report.record(f"item_asset", source, name, "error", str(e))
    cur.connection.commit()


def stage5_spell_assets(cur, cfg: Config, report: Report, pending, meta, img_index):
    if cfg.skip_assets or img_index is None or not type_wanted(cfg, "spell"):
        return
    for source_file, top_level_key, obj, idx in pending.get("spell", []):
        if not passes_filter(cfg, obj):
            continue
        name, source = obj.get("name", "?"), obj.get("source", "?")
        source_key = raw_ingest.make_source_key(obj, top_level_key, idx)
        raw_id, prev_outcome, linked_table, linked_id = meta[("spell", source_file, source_key)]
        if linked_table != "spells" or linked_id is None:
            continue
        try:
            with db_mod.savepoint(cur, "rec"):
                matched = assets_mod.link_spell_asset(
                    cur, img_index, cfg.asset_output, cfg.img_dir,
                    spell_id=linked_id, source_abbr=source, name=name,
                    has_fluff_images=bool(obj.get("hasFluffImages")),
                )
                if matched:
                    report.record_asset("spell_image_matched")
        except Exception as e:
            report.record(f"spell_asset", source, name, "error", str(e))
    cur.connection.commit()


def stage5_bastion_facility_assets(cur, cfg: Config, report: Report, pending, meta, img_index):
    if cfg.skip_assets or img_index is None or not type_wanted(cfg, "facility"):
        return
    for source_file, top_level_key, obj, idx in pending.get("facility", []):
        if not passes_filter(cfg, obj):
            continue
        name, source = obj.get("name", "?"), obj.get("source", "?")
        source_key = raw_ingest.make_source_key(obj, top_level_key, idx)
        raw_id, prev_outcome, linked_table, linked_id = meta[("facility", source_file, source_key)]
        if linked_table != "bastion_facilities" or linked_id is None:
            continue
        try:
            with db_mod.savepoint(cur, "rec"):
                matched = assets_mod.link_bastion_facility_asset(
                    cur, img_index, cfg.asset_output, cfg.img_dir,
                    facility_id=linked_id, source_abbr=source, name=name,
                    has_fluff_images=bool(obj.get("hasFluffImages")),
                )
                if matched:
                    report.record_asset("bastion_facility_image_matched")
        except Exception as e:
            report.record("bastion_facility_asset", source, name, "error", str(e))
    cur.connection.commit()


def stage6_spell_dedupe_and_classes(cur, cfg: Config, report: Report):
    """Bugs.txt #2b/#2c/#2h: not gated by --only-types, since it operates on
    the spells table as a whole rather than any one discovered entity."""
    if not type_wanted(cfg, "spell"):
        return
    dedupe_spells_mod.dedupe_spells(cur, report)
    if os.path.isfile(cfg.srd_spells_path):
        dedupe_spells_mod.backfill_spell_classes(cur, cfg.srd_spells_path, report)
    else:
        print(f"WARNING: srd-spells-path does not exist: {cfg.srd_spells_path} - skipping class backfill", file=sys.stderr)
    cur.connection.commit()


def run(cfg: Config) -> Report:
    report = Report(cfg.log_dir)
    conn = db_mod.connect(cfg)
    cur = conn.cursor()

    try:
        source_cache = sources_mod.load_sources_from_books(cur, cfg.data_dir)
        conn.commit()

        pending, all_monsters_raw = discover_all(cfg, report)

        meta = stage2_raw_ingest(cur, cfg, report, pending)

        if cfg.dry_run:
            print("--dry-run: Stage 2 raw ingest would have run as logged above; no projection performed.")
            conn.rollback()
            return report

        creature_index = copy_resolver.build_index(all_monsters_raw)

        img_index = None
        if not cfg.skip_assets:
            img_index = assets_mod.build_img_index(cfg.img_dir)

        stage4_creatures(cur, cfg, report, pending, meta, source_cache, creature_index, img_index)
        stage4_simple(cur, cfg, report, pending, meta, source_cache, "spell", project_spell)
        stage4_simple(cur, cfg, report, pending, meta, source_cache, "item", project_item)
        stage4_simple(cur, cfg, report, pending, meta, source_cache, "encounter", project_encounter)
        stage4_simple(cur, cfg, report, pending, meta, source_cache, "facility", project_bastion_facility)
        stage4_conditions(cur, cfg, report, pending, meta, source_cache)
        stage5_item_assets(cur, cfg, report, pending, meta, img_index)
        stage5_spell_assets(cur, cfg, report, pending, meta, img_index)
        stage5_bastion_facility_assets(cur, cfg, report, pending, meta, img_index)
        stage6_spell_dedupe_and_classes(cur, cfg, report)

        conn.commit()
        return report
    finally:
        summary = report.finish()
        print("\n".join(summary))
        cur.close()
        conn.close()


def main(argv=None):
    cfg = parse_args(argv)
    if not os.path.isdir(cfg.data_dir):
        print(f"ERROR: data-dir does not exist: {cfg.data_dir}", file=sys.stderr)
        return 1
    if not cfg.skip_assets and not os.path.isdir(cfg.img_dir):
        print(f"WARNING: img-dir does not exist: {cfg.img_dir} - continuing with --skip-assets behavior", file=sys.stderr)
        cfg.skip_assets = True

    start = time.time()
    run(cfg)
    elapsed = time.time() - start
    print(f"\nTotal wall-clock time: {elapsed:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
