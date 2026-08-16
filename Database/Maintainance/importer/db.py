"""Connection handling + generic upsert helpers used by every projector."""
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from . import config as config_mod


@contextmanager
def savepoint(cur, name: str = "sp"):
    """Per-record isolation: on exception, rolls back only this record's
    work (not the whole transaction) so one bad record never aborts the
    rest of the run (data_normalisation_plan.txt section 10)."""
    cur.execute(f"SAVEPOINT {name}")
    try:
        yield
        cur.execute(f"RELEASE SAVEPOINT {name}")
    except Exception:
        cur.execute(f"ROLLBACK TO SAVEPOINT {name}")
        cur.execute(f"RELEASE SAVEPOINT {name}")
        raise


def connect(cfg: "config_mod.Config"):
    conn = psycopg2.connect(**cfg.db_kwargs())
    conn.autocommit = False
    return conn


def upsert(cur, table: str, conflict_cols, values: dict, conflict_where: str = None):
    """Generic INSERT ... ON CONFLICT (...) DO UPDATE, keyed by conflict_cols.

    `conflict_where` lets the caller target a partial unique index, e.g.
    "source_id IS NOT NULL" for creatures/spells/items' (slug, source_id)
    partial unique index.

    Returns (id, was_insert: bool).
    """
    cols = list(values.keys())
    col_list = ", ".join(cols)
    placeholders = ", ".join(["%s"] * len(cols))
    conflict_list = ", ".join(conflict_cols)
    update_cols = [c for c in cols if c not in conflict_cols]
    if update_cols:
        set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    else:
        # Nothing to update (pure key columns) - no-op update keeps RETURNING working.
        set_clause = f"{conflict_cols[0]} = EXCLUDED.{conflict_cols[0]}"

    where_sql = f" WHERE {conflict_where}" if conflict_where else ""
    sql = (
        f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) "
        f"ON CONFLICT ({conflict_list}){where_sql} DO UPDATE SET {set_clause} "
        f"RETURNING id, (xmax = 0) AS was_insert"
    )
    cur.execute(sql, [values[c] for c in cols])
    row = cur.fetchone()
    return row[0], row[1]


def insert_child_rows(cur, table: str, rows: list, columns: list):
    """Bulk insert child rows (creature_actions, etc.) with no natural key -
    caller is responsible for deleting stale rows first."""
    if not rows:
        return
    col_list = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))
    sql = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})"
    psycopg2.extras.execute_batch(cur, sql, [[r.get(c) for c in columns] for r in rows])


def delete_where(cur, table: str, column: str, value):
    cur.execute(f"DELETE FROM {table} WHERE {column} = %s", (value,))
