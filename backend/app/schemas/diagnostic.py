from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StrictStr


class DiagnosticCreateResponse(BaseModel):
    id: UUID
    status: str


class DiagnosticCreateRequest(BaseModel):
    client_id: UUID | None = None


class DiagnosticRead(BaseModel):
    id: UUID
    client_id: UUID | None
    status: str
    total_score: float | None
    maturity_level: str | None
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiagnosticListItem(BaseModel):
    id: UUID
    status: str
    total_score: float | None
    maturity_level: str | None
    created_at: datetime
    completed_at: datetime | None
    client_id: UUID | None

    model_config = ConfigDict(from_attributes=True)


class AnswerUpsertRequest(BaseModel):
    diagnostic_id: UUID
    question_id: UUID
    answer_value: StrictStr


class AnswerRead(BaseModel):
    id: UUID
    diagnostic_id: UUID
    question_id: UUID
    answer_value: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClauseScoreSummary(BaseModel):
    clause: str
    raw_score: int
    weighted_score: float
    percentage: float
    answered_questions: int


class FindingRead(BaseModel):
    id: UUID
    diagnostic_id: UUID
    clause: str
    status: str
    priority: str
    title: str
    description: str | None
    recommendation: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActionTaskRead(BaseModel):
    id: UUID
    diagnostic_id: UUID
    client_id: UUID | None
    title: str
    description: str | None
    clause: str | None
    priority: str
    status: str
    due_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiagnosticEvaluationResponse(BaseModel):
    diagnostic_id: UUID
    status: str
    total_raw_score: int
    total_weighted_score: float
    total_percentage: float
    maturity_level: str
    answered_questions: int
    findings_generated: int
    tasks_generated: int
    clause_scores: list[ClauseScoreSummary]
    findings: list[FindingRead]
    tasks: list[ActionTaskRead]


class DiagnosticResultDiagnostic(BaseModel):
    id: UUID
    status: str
    total_score: float | None
    maturity_level: str | None
    created_at: datetime
    completed_at: datetime | None
    client_id: UUID | None

    model_config = ConfigDict(from_attributes=True)


class DiagnosticResultClauseSummary(BaseModel):
    clause: str
    percentage: float
    raw_score: int
    weighted_score: float


class DiagnosticResultFinding(BaseModel):
    id: UUID
    clause: str
    status: str
    priority: str
    title: str
    description: str | None
    recommendation: str | None

    model_config = ConfigDict(from_attributes=True)


class DiagnosticResultTask(BaseModel):
    id: UUID
    title: str
    description: str | None
    clause: str | None
    priority: str
    status: str
    due_date: date | None

    model_config = ConfigDict(from_attributes=True)


class DiagnosticResultResponse(BaseModel):
    diagnostic: DiagnosticResultDiagnostic
    clause_summary: list[DiagnosticResultClauseSummary]
    findings: list[DiagnosticResultFinding]
    tasks: list[DiagnosticResultTask]


class TaskListItem(BaseModel):
    id: UUID
    diagnostic_id: UUID
    client_id: UUID | None
    title: str
    description: str | None
    clause: str | None
    priority: str
    status: str
    due_date: date | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
