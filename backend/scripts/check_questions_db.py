from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

# Ensure backend root is importable when running as script:
# python scripts/check_questions_db.py
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings
from app.db.session import get_engine

EXPECTED_COLUMNS = {
    "id",
    "code",
    "clause",
    "question_text",
    "question_type",
    "help_text",
    "options_json",
    "weight",
    "sort_order",
}


def _print_header() -> None:
    settings = get_settings()
    print("== Consultor-ISO9001 DB Check ==")
    print(f"host={settings.database_host}")
    print(f"port={settings.database_port}")
    print(f"user={settings.database_username}")
    print(f"mode={settings.database_mode}")
    print("url(redacted)=", settings.database_url_redacted)


def _fetch_columns(conn: Any) -> list[str]:
    rows = conn.execute(
        text(
            """
            select column_name
            from information_schema.columns
            where table_schema='public' and table_name='diagnostic_questions'
            order by ordinal_position
            """
        )
    ).all()
    return [row[0] for row in rows]


def main() -> int:
    _print_header()
    engine = get_engine()

    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))

            table_name = conn.execute(
                text("select to_regclass('public.diagnostic_questions')")
            ).scalar_one()
            if table_name is None:
                print("ERROR: table public.diagnostic_questions does not exist.")
                return 2

            columns = _fetch_columns(conn)
            missing = sorted(EXPECTED_COLUMNS - set(columns))
            extra = sorted(set(columns) - EXPECTED_COLUMNS)

            print(f"table={table_name}")
            print(f"columns={columns}")
            if missing:
                print(f"ERROR: missing columns={missing}")
                return 3
            if extra:
                print(f"WARN: extra columns={extra}")

            row_count = conn.execute(
                text("select count(*) from public.diagnostic_questions")
            ).scalar_one()
            print(f"rows={row_count}")

            sample = conn.execute(
                text(
                    """
                    select code, clause, sort_order
                    from public.diagnostic_questions
                    order by sort_order asc
                    limit 5
                    """
                )
            ).all()
            print(f"sample={sample}")

    except OperationalError as exc:
        message = str(exc.orig)
        print(f"ERROR: operational_error={message}")
        if "tenant or user not found" in message.lower():
            print(
                "HINT: Supabase pooler rechazo tenant/user. "
                "Copia DATABASE_URL exacta desde Supabase Connect (sin construirla manualmente)."
            )
        return 1
    except SQLAlchemyError as exc:
        print(f"ERROR: sqlalchemy_error={exc}")
        return 1

    print("OK: diagnostic_questions is reachable and compatible.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
