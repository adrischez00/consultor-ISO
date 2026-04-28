from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

KPI_STATUS_VALUES = ("ok", "alerta", "critico")


class KpiIndicatorCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    target_value: float = Field(gt=0)
    current_value: float = Field(default=0)
    unit: str = Field(min_length=1, max_length=64)
    start_date: date
    end_date: date | None = None
    period_label: str | None = Field(default=None, max_length=80)
    responsible_name: str = Field(min_length=1, max_length=255)

    @model_validator(mode="after")
    def validate_period(self):
        period_label = (self.period_label or "").strip()
        if self.end_date is None and not period_label:
            raise ValueError("Debes informar end_date o period_label.")
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date no puede ser anterior a start_date.")
        return self


class KpiIndicatorUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    target_value: float | None = Field(default=None, gt=0)
    current_value: float | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=64)
    start_date: date | None = None
    end_date: date | None = None
    period_label: str | None = Field(default=None, max_length=80)
    responsible_name: str | None = Field(default=None, min_length=1, max_length=255)


class KpiIndicatorRead(BaseModel):
    id: UUID
    consultancy_id: UUID
    created_by_user_id: UUID | None
    updated_by_user_id: UUID | None
    name: str
    description: str | None
    target_value: float
    current_value: float
    unit: str
    start_date: date
    end_date: date | None
    period_label: str | None
    responsible_name: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
