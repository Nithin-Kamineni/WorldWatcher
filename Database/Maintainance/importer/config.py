"""Paths, DB connection, and CLI-tunable settings for the importer.

Everything here can be overridden by CLI flags (see cli.py); the values
below are just defaults for local development.
"""
import os
from dataclasses import dataclass, field


def _default_data_dir() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "..", "external-data", "5etools-src", "data"))


def _default_img_dir() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "..", "external-data", "5etools-img"))


def _default_asset_output() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "assets"))


def _default_log_dir() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "logs"))


def _default_srd_spells_path() -> str:
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "..", "external-data", "srd-5.2-spells.json"))


@dataclass
class Config:
    data_dir: str = field(default_factory=_default_data_dir)
    img_dir: str = field(default_factory=_default_img_dir)
    asset_output: str = field(default_factory=_default_asset_output)
    log_dir: str = field(default_factory=_default_log_dir)
    srd_spells_path: str = field(default_factory=_default_srd_spells_path)

    db_host: str = os.environ.get("WW_DB_HOST", "localhost")
    db_port: int = int(os.environ.get("WW_DB_PORT", "5432"))
    db_name: str = os.environ.get("WW_DB_NAME", "WorldWatcher_DB")
    db_user: str = os.environ.get("WW_DB_USER", "postgres")
    db_password: str = os.environ.get("WW_DB_PASSWORD", "")

    only_types: tuple = ()      # restrict Stage 4 projection to these entity types
    only_sources: tuple = ()    # restrict to these source abbreviations (upper-cased)
    allow_list: tuple = ()      # restrict to these exact entity names (case-insensitive)
    limit: int = 0              # 0 = no limit, per entity type
    dry_run: bool = False
    skip_assets: bool = False
    verbose: bool = False

    def db_kwargs(self) -> dict:
        return dict(
            host=self.db_host,
            port=self.db_port,
            dbname=self.db_name,
            user=self.db_user,
            password=self.db_password,
            connect_timeout=10,
        )
