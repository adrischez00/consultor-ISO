import logging
import re
from collections import defaultdict
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, delete, func, inspect, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps.auth import AuthContext, get_auth_context
from app.api.routes.db_error_utils import map_operational_error
from app.db.session import get_db
from app.models.action_task import ActionTask
from app.models.answer import DiagnosticAnswer
from app.models.client import Client
from app.models.diagnostic import Diagnostic
from app.models.diagnostic_finding import DiagnosticFinding
from app.models.question import DiagnosticQuestion
from app.schemas.diagnostic import (
    ActionTaskRead,
    AnswerRead,
    AnswerUpsertRequest,
    ClauseScoreSummary,
    DiagnosticCreateRequest,
    DiagnosticCreateResponse,
    DiagnosticListItem,
    DiagnosticRead,
    DiagnosticEvaluationResponse,
    DiagnosticResultClauseSummary,
    DiagnosticResultDiagnostic,
    DiagnosticResultFinding,
    DiagnosticResultResponse,
    DiagnosticResultTask,
    FindingRead,
    TaskListItem,
)

router = APIRouter(tags=["diagnostics"])
logger = logging.getLogger(__name__)

ANSWER_POINTS: dict[str, int] = {
    "yes_documented": 2,
    "partial_informal": 1,
    "no": 0,
}
STATUS_BY_POINTS: dict[int, str] = {
    2: "compliant",
    1: "partial",
    0: "non_compliant",
}
PRIORITY_BY_STATUS: dict[str, str] = {
    "compliant": "low",
    "partial": "medium",
    "non_compliant": "high",
}
TASK_RECOMMENDATION_BY_STATUS: dict[str, str] = {
    "compliant": "Mantener la evidencia actual y programar seguimiento periodico.",
    "partial": "Formalizar el proceso, definir responsables y dejar evidencia documentada.",
    "non_compliant": "Disenar e implementar el control requerido con evidencia verificable.",
}
DECIMAL_ONE = Decimal("1")
DECIMAL_TWO = Decimal("2")
DECIMAL_HUNDRED = Decimal("100")
DECIMAL_PRECISION = Decimal("0.01")
CLAUSE_NUMBER_REGEX = re.compile(r"^\d+(\.\d+)?$")


@dataclass(frozen=True)
class EvaluatedAnswer:
    answer: DiagnosticAnswer
    question: DiagnosticQuestion
    raw_score: int
    weight: Decimal
    weighted_score: Decimal
    status: str
    priority: str


@dataclass(frozen=True)
class ScoreBreakdown:
    total_raw_score: int
    total_weighted_score: Decimal
    total_percentage: Decimal
    maturity_level: str
    clause_scores: list[ClauseScoreSummary]
    evaluated_answers: list[EvaluatedAnswer]


@contextmanager
def _transaction_scope(db: Session):
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise


def _validate_answer_value(answer_value: str) -> str:
    normalized = answer_value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="answer_value no puede estar vacío")
    return normalized


def _normalize_answer_value(answer_value: str) -> str:
    return answer_value.strip().lower()


def _as_decimal(value: Decimal | float | int | None) -> Decimal:
    if value is None:
        return DECIMAL_ONE
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise HTTPException(status_code=500, detail="weight inválido en preguntas") from exc


def _round_decimal(value: Decimal) -> Decimal:
    return value.quantize(DECIMAL_PRECISION)


def _to_float(value: Decimal) -> float:
    return float(_round_decimal(value))


def _clause_sort_key(clause: str) -> tuple[float, str]:
    normalized = clause.strip()
    if CLAUSE_NUMBER_REGEX.fullmatch(normalized):
        return (float(normalized), normalized)
    return (float("inf"), normalized.lower())


def _resolve_maturity_level(total_percentage: Decimal) -> str:
    if total_percentage < Decimal("40"):
        return "low"
    if total_percentage < Decimal("70"):
        return "medium"
    return "high"


def _is_action_tasks_client_id_nullable(db: Session) -> bool:
    bind = db.get_bind()
    inspector = inspect(bind)
    columns = inspector.get_columns("action_tasks", schema="public")
    for column in columns:
        if column.get("name") == "client_id":
            return bool(column.get("nullable"))
    return False


def _diagnostic_scope_filter(auth: AuthContext):
    client_ids_subquery = select(Client.id).where(
        Client.consultancy_id == auth.consultancy.id
    )
    return or_(
        Diagnostic.client_id.in_(client_ids_subquery),
        and_(
            Diagnostic.client_id.is_(None),
            Diagnostic.created_by_user_id == auth.user.id,
        ),
    )


def _load_answer_question_rows(
    db: Session,
    diagnostic_id: UUID,
) -> list[tuple[DiagnosticAnswer, DiagnosticQuestion]]:
    return db.execute(
        select(DiagnosticAnswer, DiagnosticQuestion)
        .join(
            DiagnosticQuestion,
            DiagnosticQuestion.id == DiagnosticAnswer.question_id,
        )
        .where(DiagnosticAnswer.diagnostic_id == diagnostic_id)
        .order_by(DiagnosticQuestion.sort_order.asc(), DiagnosticQuestion.code.asc())
    ).all()


def _build_score_breakdown(
    rows: list[tuple[DiagnosticAnswer, DiagnosticQuestion]],
) -> ScoreBreakdown:
    invalid_values: set[str] = set()
    evaluated_answers: list[EvaluatedAnswer] = []
    clause_totals: dict[str, dict[str, Decimal | int]] = defaultdict(
        lambda: {
            "raw": 0,
            "weighted": Decimal("0"),
            "max_weighted": Decimal("0"),
            "count": 0,
        }
    )

    total_raw_score = 0
    total_weighted_score = Decimal("0")
    max_weighted_score = Decimal("0")

    for answer, question in rows:
        normalized_value = _normalize_answer_value(answer.answer_value or "")
        raw_score = ANSWER_POINTS.get(normalized_value)
        if raw_score is None:
            invalid_values.add(answer.answer_value or "")
            continue

        weight = _as_decimal(question.weight)
        weighted_score = Decimal(raw_score) * weight
        max_for_question = DECIMAL_TWO * weight
        status = STATUS_BY_POINTS[raw_score]
        priority = PRIORITY_BY_STATUS[status]

        evaluated_answers.append(
            EvaluatedAnswer(
                answer=answer,
                question=question,
                raw_score=raw_score,
                weight=weight,
                weighted_score=weighted_score,
                status=status,
                priority=priority,
            )
        )

        total_raw_score += raw_score
        total_weighted_score += weighted_score
        max_weighted_score += max_for_question

        clause_bucket = clause_totals[question.clause]
        clause_bucket["raw"] = int(clause_bucket["raw"]) + raw_score
        clause_bucket["weighted"] = Decimal(clause_bucket["weighted"]) + weighted_score
        clause_bucket["max_weighted"] = (
            Decimal(clause_bucket["max_weighted"]) + max_for_question
        )
        clause_bucket["count"] = int(clause_bucket["count"]) + 1

    if invalid_values:
        values = ", ".join(sorted(v for v in invalid_values if v))
        raise HTTPException(
            status_code=400,
            detail=(
                "Se detectaron answer_value no soportados para evaluar: "
                f"{values or 'valor vacío'}."
            ),
        )

    if max_weighted_score <= 0:
        raise HTTPException(
            status_code=400,
            detail="No se pudo evaluar: las preguntas no tienen peso válido.",
        )

    total_percentage = (total_weighted_score / max_weighted_score) * DECIMAL_HUNDRED
    maturity_level = _resolve_maturity_level(total_percentage)

    clause_scores: list[ClauseScoreSummary] = []
    for clause in sorted(clause_totals.keys(), key=_clause_sort_key):
        bucket = clause_totals[clause]
        clause_max_weighted = Decimal(bucket["max_weighted"])
        clause_percentage = (
            (Decimal(bucket["weighted"]) / clause_max_weighted) * DECIMAL_HUNDRED
            if clause_max_weighted > 0
            else Decimal("0")
        )
        clause_scores.append(
            ClauseScoreSummary(
                clause=clause,
                raw_score=int(bucket["raw"]),
                weighted_score=_to_float(Decimal(bucket["weighted"])),
                percentage=_to_float(clause_percentage),
                answered_questions=int(bucket["count"]),
            )
        )

    return ScoreBreakdown(
        total_raw_score=total_raw_score,
        total_weighted_score=total_weighted_score,
        total_percentage=total_percentage,
        maturity_level=maturity_level,
        clause_scores=clause_scores,
        evaluated_answers=evaluated_answers,
    )


def _set_diagnostic_in_progress(diagnostic: Diagnostic) -> None:
    diagnostic.status = "in_progress"
    diagnostic.total_score = None
    diagnostic.maturity_level = None
    diagnostic.completed_at = None


def _clear_evaluation_artifacts(db: Session, diagnostic_id: UUID) -> None:
    db.execute(
        delete(DiagnosticFinding).where(
            DiagnosticFinding.diagnostic_id == diagnostic_id
        )
    )
    db.execute(
        delete(ActionTask).where(
            ActionTask.diagnostic_id == diagnostic_id
        )
    )


def _build_evaluation_response(
    diagnostic_id: UUID,
    status: str,
    breakdown: ScoreBreakdown,
    findings: list[DiagnosticFinding],
    tasks: list[ActionTask],
) -> DiagnosticEvaluationResponse:
    return DiagnosticEvaluationResponse(
        diagnostic_id=diagnostic_id,
        status=status,
        total_raw_score=breakdown.total_raw_score,
        total_weighted_score=_to_float(breakdown.total_weighted_score),
        total_percentage=_to_float(breakdown.total_percentage),
        maturity_level=breakdown.maturity_level,
        answered_questions=len(breakdown.evaluated_answers),
        findings_generated=len(findings),
        tasks_generated=len(tasks),
        clause_scores=breakdown.clause_scores,
        findings=[FindingRead.model_validate(item) for item in findings],
        tasks=[ActionTaskRead.model_validate(item) for item in tasks],
    )


def _build_result_response(
    diagnostic: Diagnostic,
    breakdown: ScoreBreakdown,
    findings: list[DiagnosticFinding],
    tasks: list[ActionTask],
) -> DiagnosticResultResponse:
    return DiagnosticResultResponse(
        diagnostic=DiagnosticResultDiagnostic.model_validate(diagnostic),
        clause_summary=[
            DiagnosticResultClauseSummary(
                clause=item.clause,
                percentage=item.percentage,
                raw_score=item.raw_score,
                weighted_score=item.weighted_score,
            )
            for item in breakdown.clause_scores
        ],
        findings=[DiagnosticResultFinding.model_validate(item) for item in findings],
        tasks=[DiagnosticResultTask.model_validate(item) for item in tasks],
    )


def _load_completed_result_context(
    db: Session,
    diagnostic_id: UUID,
    auth: AuthContext,
) -> tuple[Diagnostic, ScoreBreakdown, list[DiagnosticFinding], list[ActionTask]]:
    diagnostic = _get_authorized_diagnostic_or_404(db, diagnostic_id, auth)
    if diagnostic.status != "completed":
        raise HTTPException(
            status_code=409,
            detail="El diagnóstico aún no está completado. Ejecuta la evaluación primero.",
        )

    rows = _load_answer_question_rows(db, diagnostic_id)
    if not rows:
        raise HTTPException(
            status_code=400,
            detail="El diagnóstico no tiene respuestas para construir la evaluación.",
        )

    breakdown = _build_score_breakdown(rows)
    findings = list(
        db.scalars(
            select(DiagnosticFinding)
            .where(DiagnosticFinding.diagnostic_id == diagnostic_id)
            .order_by(DiagnosticFinding.clause.asc(), DiagnosticFinding.created_at.asc())
        ).all()
    )
    tasks = list(
        db.scalars(
            select(ActionTask)
            .where(ActionTask.diagnostic_id == diagnostic_id)
            .order_by(ActionTask.created_at.desc())
        ).all()
    )
    return diagnostic, breakdown, findings, tasks


def _get_authorized_diagnostic_or_404(
    db: Session,
    diagnostic_id: UUID,
    auth: AuthContext,
) -> Diagnostic:
    diagnostic = db.scalar(
        select(Diagnostic).where(
            Diagnostic.id == diagnostic_id,
            _diagnostic_scope_filter(auth),
        )
    )
    if diagnostic is None:
        raise HTTPException(status_code=404, detail="Diagnóstico no encontrado")
    return diagnostic


def _get_question_or_404(db: Session, question_id: UUID) -> DiagnosticQuestion:
    question = db.scalar(select(DiagnosticQuestion).where(DiagnosticQuestion.id == question_id))
    if question is None:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    return question


def _get_scoped_client_or_404(db: Session, client_id: UUID, auth: AuthContext) -> Client:
    client = db.scalar(
        select(Client).where(
            Client.id == client_id,
            Client.consultancy_id == auth.consultancy.id,
        )
    )
    if client is None:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


def _map_integrity_error(exc: IntegrityError) -> HTTPException:
    message = str(exc.orig).lower()
    if "foreign key" in message and "client" in message:
        return HTTPException(status_code=404, detail="Cliente no encontrado")
    if "foreign key" in message and "diagnostic" in message:
        return HTTPException(status_code=404, detail="Diagnóstico no encontrado")
    if "foreign key" in message and "question" in message:
        return HTTPException(status_code=404, detail="Pregunta no encontrada")
    if "action_tasks" in message and "client_id" in message and "null value" in message:
        return HTTPException(
            status_code=409,
            detail=(
                "No se pudieron generar tareas: action_tasks.client_id sigue siendo NOT NULL "
                "y el diagnóstico no tiene client_id. Aplica el ajuste de esquema de Fase 3."
            ),
        )
    if "action_tasks_client_id_fkey" in message:
        return HTTPException(
            status_code=409,
            detail="No se pudieron generar tareas: client_id no existe en clients.",
        )
    return HTTPException(status_code=400, detail="No se pudo guardar la respuestá")


@router.post("/diagnostics", response_model=DiagnosticCreateResponse)
def create_diagnostic(
    payload: DiagnosticCreateRequest | None = None,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> DiagnosticCreateResponse:
    try:
        with _transaction_scope(db):
            client_id = payload.client_id if payload else None
            if client_id is not None:
                _get_scoped_client_or_404(db, client_id, auth)

            diagnostic = Diagnostic(
                status="draft",
                client_id=client_id,
                created_by_user_id=auth.user.id,
            )
            db.add(diagnostic)
            db.flush()
        logger.info("Diagnostic created: %s", diagnostic.id)
        return DiagnosticCreateResponse(id=diagnostic.id, status=diagnostic.status)
    except OperationalError as exc:
        logger.exception("Database connectivity error while creating diagnostic")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para crear el diagnóstico.",
        ) from exc
    except IntegrityError as exc:
        logger.exception("Integrity error while creating diagnostic")
        raise _map_integrity_error(exc) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while creating diagnostic")
        raise HTTPException(status_code=500, detail="No se pudo crear el diagnóstico") from exc


@router.get("/diagnostics", response_model=list[DiagnosticListItem])
def list_diagnostics(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[Diagnostic]:
    try:
        diagnostics = db.scalars(
            select(Diagnostic)
            .where(_diagnostic_scope_filter(auth))
            .order_by(Diagnostic.created_at.desc(), Diagnostic.id.desc())
            .limit(limit)
            .offset(offset)
        ).all()
        return list(diagnostics)
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing diagnostics")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar diagnósticos.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing diagnostics")
        raise HTTPException(status_code=500, detail="No se pudieron listar los diagnósticos") from exc


@router.get("/diagnostics/{diagnostic_id}", response_model=DiagnosticRead)
def get_diagnostic(
    diagnostic_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> Diagnostic:
    try:
        return _get_authorized_diagnostic_or_404(db, diagnostic_id, auth)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while fetching diagnostic")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el diagnóstico.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while fetching diagnostic")
        raise HTTPException(status_code=500, detail="No se pudo cargar el diagnóstico") from exc


@router.get("/tasks", response_model=list[TaskListItem])
def list_tasks(
    diagnostic_id: UUID | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[ActionTask]:
    try:
        query = (
            select(ActionTask)
            .join(Diagnostic, Diagnostic.id == ActionTask.diagnostic_id)
            .where(_diagnostic_scope_filter(auth))
        )
        if diagnostic_id is not None:
            _get_authorized_diagnostic_or_404(db, diagnostic_id, auth)
            query = query.where(ActionTask.diagnostic_id == diagnostic_id)

        tasks = db.scalars(query.order_by(ActionTask.created_at.desc(), ActionTask.id.desc())).all()
        return list(tasks)
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing tasks")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para listar tareas.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing tasks")
        raise HTTPException(status_code=500, detail="No se pudieron listar las tareas") from exc


@router.post("/answers", response_model=AnswerRead)
def upsert_answer(
    payload: AnswerUpsertRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> DiagnosticAnswer:
    answer_value = _validate_answer_value(payload.answer_value)

    try:
        with _transaction_scope(db):
            diagnostic = _get_authorized_diagnostic_or_404(db, payload.diagnostic_id, auth)
            _get_question_or_404(db, payload.question_id)

            statement = (
                pg_insert(DiagnosticAnswer)
                .values(
                    diagnostic_id=payload.diagnostic_id,
                    question_id=payload.question_id,
                    answer_value=answer_value,
                )
                .on_conflict_do_update(
                    index_elements=[DiagnosticAnswer.diagnostic_id, DiagnosticAnswer.question_id],
                    set_={
                        "answer_value": answer_value,
                        "updated_at": func.now(),
                    },
                )
                .returning(DiagnosticAnswer.id)
            )
            answer_id = db.execute(statement).scalar_one()

            _set_diagnostic_in_progress(diagnostic)
            _clear_evaluation_artifacts(db, diagnostic.id)

        answer = db.get(DiagnosticAnswer, answer_id)
        if answer is None:
            raise HTTPException(status_code=500, detail="No se pudo recuperar la respuestá guardada")

        logger.debug(
            "Answer upserted for diagnostic_id=%s question_id=%s",
            payload.diagnostic_id,
            payload.question_id,
        )
        return answer
    except HTTPException:
        raise
    except IntegrityError as exc:
        logger.exception("Integrity error while upserting answer")
        raise _map_integrity_error(exc) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while upserting answer")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para guardar la respuestá.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while upserting answer")
        raise HTTPException(status_code=500, detail="No se pudo guardar la respuestá") from exc


@router.post("/diagnostics/{diagnostic_id}/evaluate", response_model=DiagnosticEvaluationResponse)
def evaluate_diagnostic(
    diagnostic_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> DiagnosticEvaluationResponse:
    try:
        with _transaction_scope(db):
            diagnostic = _get_authorized_diagnostic_or_404(db, diagnostic_id, auth)
            rows = _load_answer_question_rows(db, diagnostic_id)

            if not rows:
                raise HTTPException(
                    status_code=400,
                    detail="El diagnóstico no tiene respuestas para evaluar.",
                )

            breakdown = _build_score_breakdown(rows)
            _clear_evaluation_artifacts(db, diagnostic_id)

            action_tasks_client_id_nullable = _is_action_tasks_client_id_nullable(db)
            if diagnostic.client_id is None and not action_tasks_client_id_nullable:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "No se pueden generar tareas: action_tasks.client_id es NOT NULL "
                        "y este diagnóstico no tiene client_id. "
                        "Haz client_id nullable para continuar en Fase 3."
                    ),
                )

            findings: list[DiagnosticFinding] = []
            tasks: list[ActionTask] = []
            for item in breakdown.evaluated_answers:
                finding = DiagnosticFinding(
                    diagnostic_id=diagnostic_id,
                    clause=item.question.clause,
                    status=item.status,
                    priority=item.priority,
                    title=f"[{item.question.code}] Estado {item.status} en cláusula {item.question.clause}",
                    description=item.question.question_text,
                    recommendation=TASK_RECOMMENDATION_BY_STATUS[item.status],
                )
                findings.append(finding)
                db.add(finding)

                if item.status == "compliant":
                    continue

                task = ActionTask(
                    diagnostic_id=diagnostic_id,
                    client_id=diagnostic.client_id,
                    title=f"Cerrar brecha de {item.question.code}",
                    description=(
                        f"Cláusula {item.question.clause}: {item.question.question_text}. "
                        f"Resultado actual: {item.status}. "
                        f"Accion recomendada: {TASK_RECOMMENDATION_BY_STATUS[item.status]}"
                    ),
                    clause=item.question.clause,
                    priority=item.priority,
                    status="pending",
                )
                tasks.append(task)
                db.add(task)

            diagnostic.total_score = _round_decimal(breakdown.total_percentage)
            diagnostic.maturity_level = breakdown.maturity_level
            diagnostic.status = "completed"
            diagnostic.completed_at = datetime.now(timezone.utc)

            db.flush()

            logger.info(
                "Diagnostic %s evaluated: answered=%s score=%s%% maturity=%s findings=%s tasks=%s",
                diagnostic_id,
                len(breakdown.evaluated_answers),
                _round_decimal(breakdown.total_percentage),
                breakdown.maturity_level,
                len(findings),
                len(tasks),
            )

            return _build_evaluation_response(
                diagnostic_id=diagnostic_id,
                status=diagnostic.status,
                breakdown=breakdown,
                findings=findings,
                tasks=tasks,
            )
    except HTTPException:
        raise
    except IntegrityError as exc:
        logger.exception("Integrity error while evaluating diagnostic")
        raise _map_integrity_error(exc) from exc
    except OperationalError as exc:
        logger.exception("Database connectivity error while evaluating diagnostic")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para evaluar el diagnóstico.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while evaluating diagnostic")
        raise HTTPException(status_code=500, detail="No se pudo evaluar el diagnóstico") from exc


@router.get("/diagnostics/{diagnostic_id}/result", response_model=DiagnosticResultResponse)
def get_diagnostic_result(
    diagnostic_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> DiagnosticResultResponse:
    try:
        diagnostic, breakdown, findings, tasks = _load_completed_result_context(
            db, diagnostic_id, auth
        )
        return _build_result_response(
            diagnostic=diagnostic,
            breakdown=breakdown,
            findings=findings,
            tasks=tasks,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while fetching diagnostic result")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar el resultado.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while fetching diagnostic result")
        raise HTTPException(status_code=500, detail="No se pudo cargar el resultado del diagnóstico") from exc


@router.get("/diagnostics/{diagnostic_id}/evaluation", response_model=DiagnosticEvaluationResponse)
def get_diagnostic_evaluation(
    diagnostic_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> DiagnosticEvaluationResponse:
    try:
        diagnostic, breakdown, findings, tasks = _load_completed_result_context(
            db, diagnostic_id, auth
        )

        return _build_evaluation_response(
            diagnostic_id=diagnostic_id,
            status=diagnostic.status,
            breakdown=breakdown,
            findings=findings,
            tasks=tasks,
        )
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while fetching diagnostic evaluation")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar la evaluación.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while fetching diagnostic evaluation")
        raise HTTPException(status_code=500, detail="No se pudo cargar la evaluación") from exc


@router.get("/diagnostics/{diagnostic_id}/answers", response_model=list[AnswerRead])
def list_diagnostic_answers(
    diagnostic_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> list[DiagnosticAnswer]:
    try:
        _get_authorized_diagnostic_or_404(db, diagnostic_id, auth)
        answers = db.scalars(
            select(DiagnosticAnswer)
            .join(DiagnosticQuestion, DiagnosticQuestion.id == DiagnosticAnswer.question_id)
            .where(DiagnosticAnswer.diagnostic_id == diagnostic_id)
            .order_by(DiagnosticQuestion.sort_order.asc(), DiagnosticAnswer.question_id.asc())
        ).all()
        return list(answers)
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.exception("Database connectivity error while listing answers")
        raise map_operational_error(
            exc,
            default_detail="No se pudo conectar a la base de datos para cargar respuestas.",
        ) from exc
    except SQLAlchemyError as exc:
        logger.exception("Database error while listing answers")
        raise HTTPException(status_code=500, detail="No se pudieron cargar las respuestas") from exc
