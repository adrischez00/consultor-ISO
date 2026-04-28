import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

# Standalone smoke test script for Supabase connectivity.
# This does not replace FastAPI app/main.py.
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    user = os.getenv("user")
    password = os.getenv("password")
    host = os.getenv("host")
    port = os.getenv("port")
    dbname = os.getenv("dbname")

    missing = [
        key
        for key, value in {
            "user": user,
            "password": password,
            "host": host,
            "port": port,
            "dbname": dbname,
        }.items()
        if value is None or not str(value).strip()
    ]
    if missing:
        raise RuntimeError(
            "DATABASE_URL no existe y faltan variables para construirla: "
            + ", ".join(missing)
        )

    DATABASE_URL = (
        f"postgresql+psycopg2://{user}:{quote_plus(password)}@{host}:{port}/{dbname}"
        "?sslmode=require"
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)

try:
    with engine.connect() as connection:
        connection.execute(text("select 1"))
    print("Connection successful!")
except SQLAlchemyError as exc:
    print(f"Failed to connect: {exc}")
