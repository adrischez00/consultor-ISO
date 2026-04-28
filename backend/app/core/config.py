import os
import re
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus, urlparse

from dotenv import load_dotenv
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError

BACKEND_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE_PATH = BACKEND_ROOT / ".env"
ENV_LOCAL_FILE_PATH = BACKEND_ROOT / ".env.local"

SUPABASE_POOLER_HOST_SUFFIX = ".pooler.supabase.com"
SUPABASE_DIRECT_HOST_PREFIX = "db."
SUPABASE_DIRECT_HOST_SUFFIX = ".supabase.co"
SUPABASE_POOLER_USER_PREFIX = "postgres."
SUPABASE_SESSION_PORT = 5432
SUPABASE_TRANSACTION_PORT = 6543
PLACEHOLDER_TOKENS = (
    "TU_PASSWORD",
    "TU_PROJECT_REF",
    "TU_SUPABASE",
    "CHANGE_ME",
    "<db_password>",
    "<project_ref>",
)
PROJECT_REF_REGEX = re.compile(r"^[a-z0-9]{20}$")


def _bootstrap_env_file() -> None:
    """
    Load backend/.env deterministically.
    - Development: .env values override inherited process vars to avoid stale IDE/session values.
    - Production: process vars keep priority; .env acts only as fallback.
    """
    if ENV_FILE_PATH.exists():
        # First pass: seed APP_ENV and any missing values.
        load_dotenv(dotenv_path=ENV_FILE_PATH, override=False)

    app_env = os.getenv("APP_ENV", "development").strip().lower()
    is_production = app_env == "production"

    if ENV_FILE_PATH.exists() and not is_production:
        # Second pass (dev): avoid stale inherited variables from IDE/session.
        load_dotenv(dotenv_path=ENV_FILE_PATH, override=True)

    # Optional local override file (gitignored) for per-machine secrets.
    if ENV_LOCAL_FILE_PATH.exists() and not is_production:
        load_dotenv(dotenv_path=ENV_LOCAL_FILE_PATH, override=True)


_bootstrap_env_file()


class Settings(BaseSettings):
    app_name: str = Field(default="Consultor ISO 9001", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    backend_host: str = Field(default="0.0.0.0", alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")
    database_url: str = Field(..., alias="DATABASE_URL")
    supabase_url: str | None = Field(default=None, alias="SUPABASE_URL")
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")
    jwt_secret_key: str = Field(
        default="consultor_iso9001_dev_secret_change_me",
        alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=480,
        alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o", alias="OPENAI_MODEL")
    openai_timeout_seconds: int = Field(default=90, alias="OPENAI_TIMEOUT_SECONDS")

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="before")
    @classmethod
    def build_database_url_from_components(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data

        raw_database_url = data.get("DATABASE_URL") or data.get("database_url")
        if isinstance(raw_database_url, str) and raw_database_url.strip():
            return data

        user = data.get("user") or data.get("DB_USER") or data.get("db_user")
        password = data.get("password") or data.get("DB_PASSWORD") or data.get("db_password")
        host = data.get("host") or data.get("DB_HOST") or data.get("db_host")
        port = data.get("port") or data.get("DB_PORT") or data.get("db_port")
        dbname = data.get("dbname") or data.get("DB_NAME") or data.get("db_name")

        components = {
            "user": user,
            "password": password,
            "host": host,
            "port": port,
            "dbname": dbname,
        }
        has_any_component = any(
            value is not None and str(value).strip() for value in components.values()
        )
        if not has_any_component:
            return data

        missing = [
            key for key, value in components.items() if value is None or not str(value).strip()
        ]
        if missing:
            raise ValueError(
                "Faltan componentes para construir DATABASE_URL: "
                + ", ".join(missing)
            )

        safe_password = quote_plus(str(password))
        data["DATABASE_URL"] = (
            f"postgresql+psycopg2://{user}:{safe_password}@{host}:{port}/{dbname}"
            "?sslmode=require"
        )
        return data

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("DATABASE_URL esta vacia")

        if any(token.lower() in normalized.lower() for token in PLACEHOLDER_TOKENS):
            raise ValueError(
                "DATABASE_URL contiene placeholders. Copia la cadena exacta de Supabase Connect."
            )

        try:
            parsed = make_url(normalized)
        except (ArgumentError, ValueError) as exc:
            raise ValueError("DATABASE_URL no tiene formato valido") from exc

        if not parsed.host:
            raise ValueError("DATABASE_URL no contiene host")

        if not parsed.drivername.startswith("postgresql"):
            raise ValueError("DATABASE_URL debe usar el esquema postgresql")

        if parsed.username is None:
            raise ValueError("DATABASE_URL no contiene usuario")

        return normalized

    @field_validator("jwt_access_token_expire_minutes")
    @classmethod
    def validate_jwt_expiration(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES debe ser mayor que 0")
        return value

    @field_validator("openai_model")
    @classmethod
    def validate_openai_model(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("OPENAI_MODEL no puede estar vacio")
        return normalized

    @field_validator("openai_timeout_seconds")
    @classmethod
    def validate_openai_timeout(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("OPENAI_TIMEOUT_SECONDS debe ser mayor que 0")
        return value

    @model_validator(mode="after")
    def validate_supabase_pooler_settings(self) -> "Settings":
        parsed = self.database_url_parsed
        host = (parsed.host or "").lower()
        username = parsed.username or ""
        port = parsed.port

        if host.endswith(SUPABASE_POOLER_HOST_SUFFIX):
            if port not in {SUPABASE_SESSION_PORT, SUPABASE_TRANSACTION_PORT}:
                raise ValueError(
                    "Supabase pooler solo acepta puerto 5432 (session) o 6543 (transaction)"
                )

            if not username.startswith(SUPABASE_POOLER_USER_PREFIX):
                raise ValueError(
                    "Para Supabase pooler usa usuario postgres.<project_ref>"
                )

            project_ref_in_user = username.removeprefix(SUPABASE_POOLER_USER_PREFIX)
            if not PROJECT_REF_REGEX.fullmatch(project_ref_in_user):
                raise ValueError(
                    "El usuario del pooler debe tener formato postgres.<project_ref>"
                )

            if self.supabase_project_ref and project_ref_in_user != self.supabase_project_ref:
                raise ValueError(
                    "DATABASE_URL y SUPABASE_URL no apuntan al mismo project_ref"
                )

            sslmode = (parsed.query or {}).get("sslmode")
            if sslmode != "require":
                raise ValueError("Supabase requiere sslmode=require en DATABASE_URL")

        if host.startswith(SUPABASE_DIRECT_HOST_PREFIX) and host.endswith(SUPABASE_DIRECT_HOST_SUFFIX):
            if port not in {None, 5432, 6543}:
                raise ValueError(
                    "Para host db.<project_ref>.supabase.co usa puerto 5432 (direct) o 6543 (transaction pooler)"
                )

            if port == 6543:
                sslmode = (parsed.query or {}).get("sslmode")
                if sslmode != "require":
                    raise ValueError("Supabase requiere sslmode=require en DATABASE_URL")

        return self

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        if not origins:
            return ["http://localhost:5173"]
        return origins

    @property
    def database_host(self) -> str:
        return self.database_url_parsed.host or "unknown"

    @property
    def database_port(self) -> int | None:
        return self.database_url_parsed.port

    @property
    def database_username(self) -> str:
        return self.database_url_parsed.username or "unknown"

    @property
    def database_url_parsed(self) -> URL:
        return make_url(self.database_url)

    @property
    def database_url_redacted(self) -> str:
        return self.database_url_parsed.render_as_string(hide_password=True)

    @property
    def database_mode(self) -> str:
        host = self.database_host.lower()
        port = self.database_port

        if host.endswith(SUPABASE_POOLER_HOST_SUFFIX):
            if port == SUPABASE_SESSION_PORT:
                return "supabase_session_pooler"
            if port == SUPABASE_TRANSACTION_PORT:
                return "supabase_transaction_pooler"
            return "supabase_pooler_unknown_port"

        if host.startswith(SUPABASE_DIRECT_HOST_PREFIX) and host.endswith(SUPABASE_DIRECT_HOST_SUFFIX):
            if port == SUPABASE_TRANSACTION_PORT:
                return "supabase_transaction_pooler"
            return "supabase_direct"

        return "custom"

    @property
    def supabase_project_ref(self) -> str | None:
        if not self.supabase_url:
            return None

        parsed = urlparse(self.supabase_url.strip())
        host = (parsed.hostname or "").lower()
        if host.endswith(SUPABASE_DIRECT_HOST_SUFFIX):
            return host.split(".")[0]

        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
