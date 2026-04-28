from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class QuestionRead(BaseModel):
    id: UUID
    code: str
    clause: str
    question_text: str
    question_type: str
    help_text: str | None
    options_json: Any | None
    weight: Decimal | float | int | None
    sort_order: int

    model_config = ConfigDict(from_attributes=True)
