"""Stage 5: image indexing, matching, hashing, copy-to-storage, dedupe.

Deviation from a literal reading of data_normalisation_plan.txt section 8
step 1: that step describes eagerly hashing every file in img/ up front.
5etools-img is a ~12GB checkout, so this implementation instead builds a
cheap PATH-only index up front (one os.walk, no hashing) and hashes a file
lazily, only once it's actually matched to an entity (section 8 step 4
already describes hashing at match time, so this is really just choosing
the cheaper of two ways to satisfy the same two steps).
"""
import mimetypes
import os
import shutil

from . import db as db_mod
from .hashing import file_sha256

IMAGE_EXTENSIONS = (".webp", ".png", ".jpg", ".jpeg")


def _norm(name: str) -> str:
    return (name or "").strip().lower()


def build_img_index(img_dir: str) -> dict:
    """One pass over img/. Returns:
      {
        ("bestiary_portrait", SOURCE_UPPER, name_lower): abs_path,
        ("bestiary_token", SOURCE_UPPER, name_lower): abs_path,
        ("item_portrait", SOURCE_UPPER, name_lower): abs_path,
      }
    """
    index = {}
    if not os.path.isdir(img_dir):
        return index

    for root, dirs, files in os.walk(img_dir):
        dirs[:] = [d for d in dirs if d != ".git"]
        rel_root = os.path.relpath(root, img_dir).replace(os.sep, "/")
        parts = [] if rel_root == "." else rel_root.split("/")

        bucket = None
        source = None
        if len(parts) == 2 and parts[0] == "bestiary" and parts[1] != "tokens":
            bucket, source = "bestiary_portrait", parts[1]
        elif len(parts) == 3 and parts[0] == "bestiary" and parts[1] == "tokens":
            bucket, source = "bestiary_token", parts[2]
        elif len(parts) == 2 and parts[0] == "items":
            bucket, source = "item_portrait", parts[1]
        elif len(parts) == 2 and parts[0] == "spells":
            bucket, source = "spell_portrait", parts[1]
        elif len(parts) == 2 and parts[0] == "bastions":
            bucket, source = "bastion_portrait", parts[1]
        if bucket is None:
            continue

        for fn in files:
            stem, ext = os.path.splitext(fn)
            if ext.lower() not in IMAGE_EXTENSIONS:
                continue
            key = (bucket, source.upper(), _norm(stem))
            index[key] = os.path.join(root, fn)

    return index


def find_match(index: dict, bucket: str, source_abbr: str, name: str):
    if not source_abbr or not name:
        return None
    return index.get((bucket, source_abbr.upper(), _norm(name)))


def _asset_storage_subpath(asset_type: str, source_abbr: str, filename: str) -> str:
    mapping = {
        "creature_portrait": f"creatures/portraits/{source_abbr}/{filename}",
        "creature_token": f"creatures/tokens/{source_abbr}/{filename}",
        "item_image": f"items/{source_abbr}/{filename}",
        "spell_image": f"spells/{source_abbr}/{filename}",
        "bastion_facility_image": f"bastions/{source_abbr}/{filename}",
    }
    return mapping.get(asset_type, f"other/{source_abbr}/{filename}")


def upsert_asset_from_file(cur, asset_output_dir: str, *, abs_source_path: str, img_dir: str,
                            asset_type: str, source_abbr: str):
    """Hash the matched file; reuse an existing `assets` row by sha256, or
    copy it into WorldWatcher's own asset storage and insert a new row.
    Returns the asset UUID."""
    sha = file_sha256(abs_source_path)

    cur.execute("SELECT id, storage_path FROM assets WHERE sha256 = %s", (sha,))
    row = cur.fetchone()
    if row:
        return row[0]

    filename = os.path.basename(abs_source_path)
    storage_rel = _asset_storage_subpath(asset_type, source_abbr, filename)
    dest_path = os.path.join(asset_output_dir, storage_rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    if not os.path.exists(dest_path):
        shutil.copyfile(abs_source_path, dest_path)

    file_size = os.path.getsize(abs_source_path)
    mime_type = mimetypes.guess_type(abs_source_path)[0]
    source_path = os.path.relpath(abs_source_path, img_dir).replace(os.sep, "/")

    values = {
        "filename": filename,
        "storage_path": storage_rel,
        "asset_type": asset_type,
        "mime_type": mime_type,
        "width": None,
        "height": None,
        "file_size": file_size,
        "sha256": sha,
        "source": "5etools-img",
        "source_path": source_path,
        "raw_data": None,
    }
    asset_id, _ = db_mod.upsert(cur, "assets", ["sha256"], values)
    return asset_id


def link_creature_assets(cur, index: dict, asset_output_dir: str, img_dir: str, *,
                          creature_id, source_abbr: str, name: str, has_token: bool, has_fluff_images: bool):
    if not (has_token or has_fluff_images):
        return

    portrait_path = find_match(index, "bestiary_portrait", source_abbr, name)
    token_path = find_match(index, "bestiary_token", source_abbr, name)

    portrait_asset_id = None
    token_asset_id = None
    if portrait_path:
        portrait_asset_id = upsert_asset_from_file(
            cur, asset_output_dir, abs_source_path=portrait_path, img_dir=img_dir,
            asset_type="creature_portrait", source_abbr=source_abbr,
        )
    if token_path:
        token_asset_id = upsert_asset_from_file(
            cur, asset_output_dir, abs_source_path=token_path, img_dir=img_dir,
            asset_type="creature_token", source_abbr=source_abbr,
        )

    if portrait_asset_id or token_asset_id:
        cur.execute(
            """
            UPDATE creatures SET
              portrait_asset_id = COALESCE(%s, portrait_asset_id),
              token_asset_id = COALESCE(%s, token_asset_id)
            WHERE id = %s
            """,
            (portrait_asset_id, token_asset_id, creature_id),
        )
    return portrait_path is not None, token_path is not None


def link_item_asset(cur, index: dict, asset_output_dir: str, img_dir: str, *,
                     item_id, source_abbr: str, name: str, has_fluff_images: bool):
    if not has_fluff_images:
        return False

    path = find_match(index, "item_portrait", source_abbr, name)
    if not path:
        return False

    asset_id = upsert_asset_from_file(
        cur, asset_output_dir, abs_source_path=path, img_dir=img_dir,
        asset_type="item_image", source_abbr=source_abbr,
    )
    cur.execute("UPDATE items SET image_asset_id = %s WHERE id = %s", (asset_id, item_id))
    return True


def link_spell_asset(cur, index: dict, asset_output_dir: str, img_dir: str, *,
                      spell_id, source_abbr: str, name: str, has_fluff_images: bool):
    if not has_fluff_images:
        return False

    path = find_match(index, "spell_portrait", source_abbr, name)
    if not path:
        return False

    asset_id = upsert_asset_from_file(
        cur, asset_output_dir, abs_source_path=path, img_dir=img_dir,
        asset_type="spell_image", source_abbr=source_abbr,
    )
    cur.execute("UPDATE spells SET image_asset_id = %s WHERE id = %s", (asset_id, spell_id))
    return True


def link_bastion_facility_asset(cur, index: dict, asset_output_dir: str, img_dir: str, *,
                                 facility_id, source_abbr: str, name: str, has_fluff_images: bool):
    if not has_fluff_images:
        return False

    path = find_match(index, "bastion_portrait", source_abbr, name)
    if not path:
        return False

    asset_id = upsert_asset_from_file(
        cur, asset_output_dir, abs_source_path=path, img_dir=img_dir,
        asset_type="bastion_facility_image", source_abbr=source_abbr,
    )
    cur.execute("UPDATE bastion_facilities SET image_asset_id = %s WHERE id = %s", (asset_id, facility_id))
    return True
