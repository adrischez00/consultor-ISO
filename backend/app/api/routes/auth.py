import logging
from contextlib import contextmanager

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.consultancy import Consultancy
from app.models.consultancy_member import ConsultancyMember
from app.models.user import User
from app.schemas.auth import (
    AuthConsultancyRead,
    AuthLoginRequest,
    AuthMeResponse,
    AuthRegisterRequest,
    AuthTokenResponse,
    AuthUserRead,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="email es requerido")
    return normalized


def _normalize_required_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail=f"{field_name} es requerido")
    return normalized


def _load_primary_consultancy_for_user(
    db: Session,
    user_id,
) -> tuple[ConsultancyMember, Consultancy] | None:
    row = db.execute(
        select(ConsultancyMember, Consultancy)
        .join(Consultancy, Consultancy.id == ConsultancyMember.consultancy_id)
        .where(ConsultancyMember.user_id == user_id)
        .order_by(ConsultancyMember.created_at.asc(), ConsultancyMember.id.asc())
    ).first()
    if row is None:
        return None
    return row[0], row[1]


def _build_auth_response(user: User, consultancy: Consultancy) -> AuthTokenResponse:
    return AuthTokenResponse(
        access_token=create_access_token(user.id, consultancy.id),
        token_type="bearer",
        user=AuthUserRead.model_validate(user),
        consultancy=AuthConsultancyRead.model_validate(consultancy),
    )


def _map_auth_integrity_error(exc: IntegrityError) -> HTTPException:
    message = str(exc.orig).lower()
    if "users_email_key" in message or "unique" in message and "email" in message:
        return HTTPException(status_code=409, detail="Ya existe un usuario con ese email")
    return HTTPException(status_code=400, detail="No se pudo completar la operación de auth")


@router.post("/register", response_model=AuthTokenResponse)
def register(
    payload: AuthRegisterRequest,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    try:
        with _transaction_scope(db):
            email = _normalize_email(payload.email)
            existing_user = db.scalar(select(User).where(User.email == email))
            if existing_user is not None:
                raise HTTPException(status_code=409, detail="Ya existe un usuario con ese email")

            user = User(
                full_name=_normalize_required_text(payload.full_name, "full_name"),
                email=email,
                password_hash=hash_password(payload.password),
                is_active=True,
            )
            db.add(user)
            db.flush()

            consultancy = Consultancy(
                name=_normalize_required_text(payload.consultancy_name, "consultancy_name")
            )
            db.add(consultancy)
            db.flush()

            membership = ConsultancyMember(
                consultancy_id=consultancy.id,
                user_id=user.id,
                role="admin",
            )
            db.add(membership)
            db.flush()

        logger.info("User registered: user_id=%s consultancy_id=%s", user.id, consultancy.id)
        return _build_auth_response(user, consultancy)
    except HTTPException:
        raise
    except IntegrityError as exc:
        logger.exception("Integrity error while registering user")
        raise _map_auth_integrity_error(exc) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while registering user")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para registrar usuario.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while registering user")
        raise HTTPException(status_code=500, detail="No se pudo registrar usuario") from exc


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: AuthLoginRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    try:
        email = _normalize_email(payload.email)
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas",
            )

        if hasattr(user, "is_active") and not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario inactivo",
            )

        membership_context = _load_primary_consultancy_for_user(db, user.id)
        if membership_context is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario sin membresía de consultoría activa",
            )

        _, consultancy = membership_context
        return _build_auth_response(user, consultancy)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while logging in")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para iniciar sesión.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while logging in")
        raise HTTPException(status_code=500, detail="No se pudo iniciar sesión") from exc


@router.get("/me", response_model=AuthMeResponse)
def me(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuthMeResponse:
    if isinstance(auth.user, User) and isinstance(auth.consultancy, Consultancy):
        user = auth.user
        consultancy = auth.consultancy
    else:
        user = db.scalar(select(User).where(User.id == auth.user.id))
        consultancy = db.scalar(select(Consultancy).where(Consultancy.id == auth.consultancy.id))
        if user is None or consultancy is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sesión no válida. Inicia sesión nuevamente.",
            )
    return AuthMeResponse(
        user=AuthUserRead.model_validate(user),
        consultancy=AuthConsultancyRead.model_validate(consultancy),
    )

