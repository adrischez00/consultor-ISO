from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.consultancy import Consultancy
from app.models.consultancy_member import ConsultancyMember
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class TokenUser:
    id: UUID


@dataclass(frozen=True)
class TokenConsultancy:
    id: UUID


@dataclass(frozen=True)
class TokenMembership:
    user_id: UUID
    consultancy_id: UUID
    role: str = "member"


@dataclass(frozen=True)
class AuthContext:
    user: User | TokenUser
    consultancy: Consultancy | TokenConsultancy
    membership: ConsultancyMember | TokenMembership


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso requerido",
        )

    payload = decode_access_token(credentials.credentials)
    try:
        user_id = UUID(str(payload["sub"]))
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token con subject inválido",
        ) from exc

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or (hasattr(user, "is_active") and not user.is_active):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no válido para está sesión",
        )

    return user


def _get_primary_membership(
    db: Session,
    user_id: UUID,
) -> tuple[ConsultancyMember, Consultancy]:
    row = db.execute(
        select(ConsultancyMember, Consultancy)
        .join(Consultancy, Consultancy.id == ConsultancyMember.consultancy_id)
        .where(ConsultancyMember.user_id == user_id)
        .order_by(ConsultancyMember.created_at.asc(), ConsultancyMember.id.asc())
    ).first()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario sin membresía de consultoría activa",
        )

    return row[0], row[1]


def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthContext:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acceso requerido",
        )

    payload = decode_access_token(credentials.credentials)
    try:
        user_id = UUID(str(payload["sub"]))
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token con subject inválido",
        ) from exc

    consultancy_id_raw = payload.get("cid")
    if consultancy_id_raw:
        try:
            consultancy_id = UUID(str(consultancy_id_raw))
        except (ValueError, TypeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token con consultancy_id inválido",
            ) from exc
        return AuthContext(
            user=TokenUser(id=user_id),
            consultancy=TokenConsultancy(id=consultancy_id),
            membership=TokenMembership(user_id=user_id, consultancy_id=consultancy_id),
        )

    row = db.execute(
        select(User, ConsultancyMember, Consultancy)
        .join(ConsultancyMember, ConsultancyMember.user_id == User.id)
        .join(Consultancy, Consultancy.id == ConsultancyMember.consultancy_id)
        .where(User.id == user_id)
        .order_by(ConsultancyMember.created_at.asc(), ConsultancyMember.id.asc())
    ).first()

    if row is None:
        user_exists = db.scalar(select(User.id).where(User.id == user_id))
        if user_exists is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario no válido para está sesión",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario sin membresía de consultoría activa",
        )

    user, membership, consultancy = row
    if hasattr(user, "is_active") and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no válido para está sesión",
        )

    return AuthContext(user=user, consultancy=consultancy, membership=membership)
