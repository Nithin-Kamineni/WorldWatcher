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

    # Vite falls back to 5174, 5175, ... when 5173 is already taken (a second `npm run dev`,
    # or a stale one holding the port). Allowing only 5173 made that fallback look exactly
    # like a dead backend: the page loads, every request fails CORS, the app sits spinning.
    # The whole fallback range is allowed instead, so the symptom cannot recur.
    ww_cors_origins: str = ",".join(
        f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in range(5173, 5181)
    )

    ww_host: str = "0.0.0.0"
    # Kept in step with Client/.env, which is what the browser actually calls; this said 8000
    # long after the client moved to 8006.
    ww_port: int = 8006
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
