from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditReport(Base):
    __tablename__ = "audit_reports"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        index=True,
        server_default=text("gen_random_uuid()"),
    )
    consultancy_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("consultancies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    client_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("audit_templates.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approved_by_user_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_diagnostic_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("diagnostics.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    report_year: Mapped[int] = mapped_column(Integer, nullable=False)
    report_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="draft")
    entity_name: Mapped[str] = mapped_column(Text, nullable=False)
    auditor_organization: Mapped[str | None] = mapped_column(Text, nullable=True)
    audited_area: Mapped[str | None] = mapped_column(Text, nullable=True)
    audit_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    tipo_auditoria: Mapped[str] = mapped_column(Text, nullable=False, default="inicial")
    modalidad: Mapped[str] = mapped_column(Text, nullable=False, default="presencialmente")
    audited_facilities: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_responsible_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_standard: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="UNE EN ISO 9001:2015",
    )
    reference_standard_revision: Mapped[str | None] = mapped_column(Text, nullable=True)
    audit_budget_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    audit_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    conclusions_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_dispositions_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
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
