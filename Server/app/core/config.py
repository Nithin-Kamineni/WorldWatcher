"""Central settings, loaded from environment variables / .env via pydantic-settings."""
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

_HERE = os.path.dirname(os.path.abspath(__file__))
_SERVER_ROOT = os.path.normpath(os.path.join(_HERE, "..", ".."))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(_SERVER_ROOT, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ww_secret_key: str = "dev-secret-change-me"

    ww_db_host: str = "localhost"
    ww_db_port: int = 5432
    ww_db_name: str = "WorldWatcher_DB"
    ww_db_user: str = "postgres"
    ww_db_password: str = ""

    ww_assets_dir: str = "../Database/Maintainance/assets"
    ww_asset_upload_max_mb: int = 25

    ww_cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    ww_host: str = "0.0.0.0"
    ww_port: int = 8000
    ww_debug: bool = True

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.ww_cors_origins.split(",") if o.strip()]

    @property
    def assets_dir(self) -> str:
        return os.path.normpath(os.path.join(_SERVER_ROOT, self.ww_assets_dir))

    @property
    def async_database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.ww_db_user}:{self.ww_db_password}"
            f"@{self.ww_db_host}:{self.ww_db_port}/{self.ww_db_name}"
        )

    @property
    def sync_database_url(self) -> str:
        """Used by Alembic, which drives migrations synchronously."""
        return (
            f"postgresql+psycopg2://{self.ww_db_user}:{self.ww_db_password}"
            f"@{self.ww_db_host}:{self.ww_db_port}/{self.ww_db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
