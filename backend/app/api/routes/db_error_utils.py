from fastapi import HTTPException
from sqlalchemy.exc import OperationalError


def map_operational_error(exc: OperationalError, default_detail: str) -> HTTPException:
    message = str(exc.orig).lower()

    if "tenant or user not found" in message:
        return HTTPException(
            status_code=503,
            detail=(
                "Conexión rechazada por Supabase pooler (tenant/user no encontrado). "
                "Verifica que DATABASE_URL sea la cadena exacta de Connect."
            ),
        )

    if "could not translate host name" in message:
        return HTTPException(
            status_code=503,
            detail=(
                "No se pudo resolver el host de base de datos. "
                "Revisa host DNS en DATABASE_URL."
            ),
        )

    if "permission denied" in message:
        return HTTPException(
            status_code=503,
            detail=(
                "Conexión bloqueada por red o firewall hacia la base de datos. "
                "Revisa reglas de salida y acceso al pooler."
            ),
        )

    return HTTPException(status_code=503, detail=default_detail)


