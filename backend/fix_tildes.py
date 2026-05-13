#!/usr/bin/env python3
"""
Fix missing tildes in existing database records.
Run from the backend/ directory: python fix_tildes.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.db.session import SessionLocal

# Each tuple: (old_text, new_text) — applied in order across all text columns
REPLACEMENTS = [
    # Adjectives and nouns ending in -ico/-ica
    ("Economico", "Económico"),
    ("economico", "económico"),
    ("climatico", "climático"),
    ("Climatico", "Climático"),
    ("tecnologico", "tecnológico"),
    ("Tecnologico", "Tecnológico"),
    ("tecnologica", "tecnológica"),
    ("Tecnologica", "Tecnológica"),
    # -ción words
    ("Adaptacion", "Adaptación"),
    ("adaptacion", "adaptación"),
    ("Automatizacion", "Automatización"),
    ("automatizacion", "automatización"),
    ("Comunicacion", "Comunicación"),
    ("comunicacion", "comunicación"),
    ("coordinacion", "coordinación"),
    ("Coordinacion", "Coordinación"),
    ("Desalineacion", "Desalineación"),
    ("desalineacion", "desalineación"),
    ("Diferenciacion", "Diferenciación"),
    ("diferenciacion", "diferenciación"),
    ("digitalizacion", "digitalización"),
    ("Digitalizacion", "Digitalización"),
    ("ejecucion", "ejecución"),
    ("Ejecucion", "Ejecución"),
    ("Especializacion", "Especialización"),
    ("especializacion", "especialización"),
    ("Estandarizacion", "Estandarización"),
    ("estandarizacion", "estandarización"),
    ("formacion", "formación"),
    ("Formacion", "Formación"),
    ("Informacion", "Información"),
    ("informacion", "información"),
    ("Inflacion", "Inflación"),
    ("inflacion", "inflación"),
    ("Innovacion", "Innovación"),
    ("innovacion", "innovación"),
    ("Optimizacion", "Optimización"),
    ("optimizacion", "optimización"),
    ("percepcion", "percepción"),
    ("Percepcion", "Percepción"),
    ("presion", "presión"),
    ("Presion", "Presión"),
    ("reduccion", "reducción"),
    ("Reduccion", "Reducción"),
    ("tesoreria", "tesorería"),
    ("Tesoreria", "Tesorería"),
    ("tension", "tensión"),
    ("Tension", "Tensión"),
    # -cia / other
    ("tecnica", "técnica"),
    ("Tecnica", "Técnica"),
    (" agil", " ágil"),
    ("Agil ", "Ágil "),
]

TABLES_AND_COLUMNS = {
    "audit_context_document_rows": [
        "environment", "risks", "opportunities", "actions", "observations",
    ],
    "audit_interested_parties_document_rows": [
        "stakeholder_name", "needs", "expectations", "requirements",
        "risks", "opportunities", "actions", "needs_expectations", "observations",
    ],
}


def apply_replacements_to_column(column: str) -> str:
    """Build nested REPLACE() SQL expression for a column."""
    expr = column
    for old, new in REPLACEMENTS:
        # Escape single quotes in the replacement strings (none here, but be safe)
        old_escaped = old.replace("'", "''")
        new_escaped = new.replace("'", "''")
        expr = f"REPLACE({expr}, '{old_escaped}', '{new_escaped}')"
    return expr


def main():
    db = SessionLocal()
    try:
        for table, columns in TABLES_AND_COLUMNS.items():
            set_clauses = [f"{col} = {apply_replacements_to_column(col)}" for col in columns]
            sql = f"UPDATE {table} SET {', '.join(set_clauses)}"
            result = db.execute(text(sql))
            print(f"  {table}: {result.rowcount} rows processed")

        db.commit()
        print("\nDone. Commit successful.")
    except Exception as exc:
        db.rollback()
        print(f"\nError — rollback applied: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
