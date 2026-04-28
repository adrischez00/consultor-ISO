from uuid import UUID

from sqlalchemy import Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class DiagnosticQuestion(Base):
    __tablename__ = "diagnostic_questions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    clause: Mapped[str] = mapped_column(String(32), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(32), nullable=False)
    help_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    options_json: Mapped[dict | list | None] = mapped_column(JSONB, nullable=True)
    weight: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
