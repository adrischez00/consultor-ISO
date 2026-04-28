import logging

from fastapi import APIRouter, Depends
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import DataError, OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.routes.db_error_utils import map_operational_error
from app.db.session import get_db
from app.models.question import DiagnosticQuestion
from app.schemas.question import QuestionRead

router = APIRouter(tags=["questions"])
logger = logging.getLogger(__name__)


@router.get("/questions", response_model=list[QuestionRead])
def list_questions(db: Session = Depends(get_db)) -> list[DiagnosticQuestion]:
    try:
        query = select(DiagnosticQuestion).order_by(DiagnosticQuestion.sort_order.asc())
        result = db.scalars(query).all()
        logger.debug("Questions fetched: %s", len(result))
        return list(result)
    except OperationalError as exc:
        logger.exception("Database connectivity error while fetching questions")
        raise map_operational_error(
            exc,
            default_detail=(
                "No se pudo conectar a la base de datos para cargar preguntas. "
                "Revisa DATABASE_URL, red y credenciales."
            ),
        ) from exc
    except ProgrammingError as exc:
        logger.exception("Database schema error while fetching questions")

        message = str(exc.orig).lower()
        if "relation \"diagnostic_questions\" does not exist" in message:
            raise HTTPException(
                status_code=500,
                detail="La tabla public.diagnostic_questions no existe en la base de datos configurada.",
            ) from exc

        if "column" in message and "diagnostic_questions" in message and "does not exist" in message:
            raise HTTPException(
                status_code=500,
                detail="La estructura de public.diagnostic_questions no coincide con el modelo esperado.",
            ) from exc

        raise HTTPException(
            status_code=500,
            detail="Error de esquema SQL al cargar preguntas.",
        ) from exc
    except DataError as exc:
        logger.exception("Data error while fetching questions")
        raise HTTPException(
            status_code=500,
            detail="Error de datos en diagnostic_questions.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while fetching questions: %s", exc)
        raise HTTPException(status_code=500, detail="Error interno al cargar preguntas") from exc
