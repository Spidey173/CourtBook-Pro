"""Booking Validation Schemas."""
import datetime
from typing import Dict, Optional, Any, Union
from pydantic import BaseModel, Field, field_validator, model_validator


VALID_TIME_SLOTS = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00'
]


class BookingCreateSchema(BaseModel):
    """Schema for creating a new booking reservation."""
    court_id: int = Field(..., gt=0, description="Court ID")
    date: datetime.date = Field(..., description="Reservation date (YYYY-MM-DD)")
    time_slot: str = Field(..., description="Starting time slot e.g. '08:00'")
    duration: int = Field(default=1, ge=1, le=12, description="Duration in hours (1-12)")
    coach_id: Optional[int] = Field(default=None, description="Optional Coach ID")
    equipment: Dict[str, int] = Field(default_factory=dict, description="Dictionary of equipment_id -> quantity")
    client_estimated_price: Optional[int] = Field(default=None, description="Optional client estimate for mismatch warning")

    @model_validator(mode='before')
    @classmethod
    def normalize_input(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Support court: { id: 1 } or court_id: 1
            if 'court_id' not in data and 'court' in data and isinstance(data['court'], dict):
                data['court_id'] = data['court'].get('id')
            # Support coach: { id: 2 } or coach_id: 2
            if 'coach_id' not in data and 'coach' in data and isinstance(data['coach'], dict):
                data['coach_id'] = data['coach'].get('id')
            # Support camelCase timeSlot
            if 'time_slot' not in data and 'timeSlot' in data:
                data['time_slot'] = data['timeSlot']
            # Support totalPrice as estimate
            if 'client_estimated_price' not in data and 'totalPrice' in data:
                data['client_estimated_price'] = data['totalPrice']
            elif 'client_estimated_price' not in data and 'total_price' in data:
                data['client_estimated_price'] = data['total_price']
        return data

    @field_validator('time_slot')
    @classmethod
    def validate_slot(cls, v: str) -> str:
        if v not in VALID_TIME_SLOTS:
            raise ValueError(f"Invalid time slot '{v}'. Must be one of {VALID_TIME_SLOTS}")
        return v

    @field_validator('date')
    @classmethod
    def validate_booking_date(cls, v: datetime.date) -> datetime.date:
        today = datetime.date.today()
        if v < today:
            raise ValueError(f"Booking date {v} cannot be in the past.")
        return v


class PriceCalculateSchema(BaseModel):
    """Schema for querying price calculation for a potential booking."""
    court_id: int = Field(..., gt=0)
    date: datetime.date = Field(...)
    time_slot: str = Field(...)
    duration: int = Field(default=1, ge=1, le=12)
    coach_id: Optional[int] = Field(default=None)
    equipment: Dict[str, int] = Field(default_factory=dict)

    @model_validator(mode='before')
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'court_id' not in data and 'court' in data and isinstance(data['court'], dict):
                data['court_id'] = data['court'].get('id')
            if 'coach_id' not in data and 'coach' in data and isinstance(data['coach'], dict):
                data['coach_id'] = data['coach'].get('id')
            if 'time_slot' not in data and 'timeSlot' in data:
                data['time_slot'] = data['timeSlot']
        return data


class AvailabilityQuerySchema(BaseModel):
    """Schema for querying resource availability."""
    date: datetime.date = Field(..., description="Query date (YYYY-MM-DD)")
    time_slot: Optional[str] = Field(default=None, description="Optional time slot filter")
    duration: int = Field(default=1, ge=1, le=12, description="Duration in hours")

    @model_validator(mode='before')
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if 'time_slot' not in data and 'timeSlot' in data:
                data['time_slot'] = data['timeSlot']
            if 'time_slot' not in data and 'time' in data:
                data['time_slot'] = data['time']
        return data
