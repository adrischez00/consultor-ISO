from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AuditInterestedPartiesDocumentRow(Base):
    __tablename__ = "audit_interested_parties_document_rows"
    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "sort_order",
            name="audit_interested_parties_document_rows_document_id_sort_order_key",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        index=True,
        server_default=text("gen_random_uuid()"),
    )
    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("audit_interested_parties_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    stakeholder_name: Mapped[str] = mapped_column(Text, nullable=False)
    needs: Mapped[str | None] = mapped_column(Text, nullable=True)
    expectations: Mapped[str | None] = mapped_column(Text, nullable=True)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    risks: Mapped[str | None] = mapped_column(Text, nullable=True)
    opportunities: Mapped[str | None] = mapped_column(Text, nullable=True)
    actions: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Deprecated compatibility field. New flows should use `needs` and `expectations`.
    needs_expectations: Mapped[str | None] = mapped_column(Text, nullable=True)
    applies: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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
