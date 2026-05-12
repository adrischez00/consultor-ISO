import logging
from contextlib import contextmanager
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.db.session import get_db
from app.models.client import Client
from app.models.diagnostic import Diagnostic
from app.schemas.client import (
    ClientCreateRequest,
    ClientDetailResponse,
    ClientDiagnosticItem,
    ClientListItem,
    ClientRead,
)

router = APIRouter(tags=["clients"])
logger = logging.getLogger(__name__)


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_required_name(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="name es requerido")
    return normalized


def _get_client_or_404(db: Session, client_id: UUID, consultancy_id: UUID) -> Client:
    client = db.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.consultancy_id == consultancy_id,
        )
    )
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


def _map_client_integrity_error(exc: IntegrityError) -> HTTPException:
    message = str(exc.orig).lower()

    if "clients_user_id_fkey" in message:
        return HTTPException(
            status_code=409,
            detail=(
                "No se pudo crear el cliente: clients.user_id requiere un usuario válido. "
                "Define un valor por defecto en BD año habilita auth antes de forzar esta restriccion."
            ),
        )

    if "null value" in message and "user_id" in message:
        return HTTPException(
            status_code=409,
            detail=(
                "No se pudo crear el cliente: clients.user_id es NOT NULL en tu esquema actual. "
                "Para esta fase sin auth, haz user_id nullable año agrega valor por defecto en BD."
            ),
        )

    return HTTPException(status_code=400, detail="No se pudo guardar el cliente")


@router.get("/clients", response_model=list[ClientListItem])
def list_clients(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[Client]:
    try:
        clients = db.scalars(
            select(Client)
            .where(Client.consultancy_id == auth.consultancy.id)
            .order_by(Client.created_at.desc(), Client.id.desc())
        ).all()
        return list(clients)
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing clients")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar clientes.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing clients")
        raise HTTPException(status_code=500, detail="No se pudieron listar los clientes") from exc


@router.post("/clients", response_model=ClientRead)
def create_client(
    payload: ClientCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Client:
    try:
        client: Client | None = None
        with _transaction_scope(db):
            client = Client(
                name=_normalize_required_name(payload.name),
                sector=_normalize_optional_text(payload.sector),
                employee_count=payload.employee_count,
                description=_normalize_optional_text(payload.description),
                status="active",
                consultancy_id=auth.consultancy.id,
                user_id=auth.user.id,
            )
            db.add(client)
            db.flush()

        if client is None:
            raise HTTPException(status_code=500, detail="No se pudo crear el cliente")

        db.refresh(client)
        logger.info(
            "Client created: client_id=%s consultancy_id=%s user_id=%s",
            client.id,
            auth.consultancy.id,
            auth.user.id,
        )
        return client
    except HTTPException:
        raise
    except IntegrityError as exc:
        logger.exception("Integrity error while creating client")
        raise _map_client_integrity_error(exc) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating client")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el cliente.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while creating client")
        raise HTTPException(status_code=500, detail="No se pudo crear el cliente") from exc


@router.get("/clients/{client_id}", response_model=ClientDetailResponse)
def get_client_detail(
    client_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> ClientDetailResponse:
    try:
        client = _get_client_or_404(db, client_id, auth.consultancy.id)
        diagnostics = db.scalars(
            select(Diagnostic)
            .where(Diagnostic.client_id == client_id)
            .order_by(Diagnostic.created_at.desc(), Diagnostic.id.desc())
        ).all()
        return ClientDetailResponse(
            client=ClientRead.model_validate(client),
            diagnostics=[ClientDiagnosticItem.model_validate(item) for item in diagnostics],
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while loading client detail")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el cliente.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while loading client detail")
        raise HTTPException(status_code=500, detail="No se pudo cargar el cliente") from exc


@router.get("/clients/{client_id}/diagnostics", response_model=list[ClientDiagnosticItem])
def list_client_diagnostics(
    client_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[Diagnostic]:
    try:
        _get_client_or_404(db, client_id, auth.consultancy.id)
        diagnostics = db.scalars(
            select(Diagnostic)
            .where(Diagnostic.client_id == client_id)
            .order_by(Diagnostic.created_at.desc(), Diagnostic.id.desc())
        ).all()
        return list(diagnostics)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing client diagnostics")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar diagnósticos del cliente.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing client diagnostics")
        raise HTTPException(
            status_code=500,
            detail="No se pudieron listar los diagnósticos del cliente",
        ) from exc

