import logging
from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def get_engine():
    settings = get_settings()
    engine_kwargs = {
        "pool_recycle": 300,
    }

    # Transaction pooler (6543) already does server-side pooling.
    # Avoid stacking pools to reduce stale-connection edge cases.
    if settings.database_mode == "supabase_transaction_pooler":
        engine_kwargs["poolclass"] = NullPool
        engine_kwargs["pool_pre_ping"] = False
        logger.info("Using NullPool for Supabase transaction pooler (port 6543)")
    elif settings.database_mode == "supabase_session_pooler":
        # Session pooler already keeps connections healthy and pre_ping adds
        # an extra round-trip per request.
        engine_kwargs["pool_pre_ping"] = False
    else:
        engine_kwargs["pool_pre_ping"] = True

    engine = create_engine(
        settings.database_url,
        **engine_kwargs,
    )
    logger.debug(
        "SQLAlchemy engine created for host=%s port=%s mode=%s",
        settings.database_host,
        settings.database_port,
        settings.database_mode,
    )
    return engine


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
