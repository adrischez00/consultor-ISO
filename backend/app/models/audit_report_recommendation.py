from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditReportRecommendation(Base):
    __tablename__ = "audit_report_recommendations"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        index=True,
        server_default=text("gen_random_uuid()"),
    )
    audit_report_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("audit_reports.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    consultancy_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("consultancies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation_year: Mapped[int] = mapped_column(Integer, nullable=False)
    source_audit_report_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("audit_reports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recommendation_type: Mapped[str] = mapped_column(Text, nullable=False, default="recommendation")
    priority: Mapped[str] = mapped_column(Text, nullable=False, default="medium")
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    followup_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendation_status: Mapped[str] = mapped_column(Text, nullable=False, default="new")
    carried_from_previous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    generated_by_ai: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
