"""Admin Management Validation Schemas."""
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class CourtCreateUpdateSchema(BaseModel):
    """Schema for adding or updating a court."""
    name: str = Field(..., min_length=2, max_length=100)
    type: str = Field(..., pattern="^(indoor|outdoor)$")
    base_price: int = Field(..., ge=0)
    is_active: bool = Field(default=True)

    @classmethod
    def from_input(cls, data: dict):
        payload = dict(data)
        if 'basePrice' in payload and 'base_price' not in payload:
            payload['base_price'] = payload['basePrice']
        if 'isActive' in payload and 'is_active' not in payload:
            payload['is_active'] = payload['isActive']
        return cls(**payload)


class EquipmentCreateUpdateSchema(BaseModel):
    """Schema for adding or updating equipment."""
    name: str = Field(..., min_length=2, max_length=100)
    price: int = Field(..., ge=0)
    total_available: int = Field(..., ge=0)
    is_active: bool = Field(default=True)

    @classmethod
    def from_input(cls, data: dict):
        payload = dict(data)
        if 'totalAvailable' in payload and 'total_available' not in payload:
            payload['total_available'] = payload['totalAvailable']
        if 'isActive' in payload and 'is_active' not in payload:
            payload['is_active'] = payload['isActive']
        return cls(**payload)


class CoachCreateUpdateSchema(BaseModel):
    """Schema for adding or updating a coach."""
    name: str = Field(..., min_length=2, max_length=100)
    price: int = Field(..., ge=0)
    specialization: str = Field(default='', max_length=200)
    is_active: bool = Field(default=True)

    @classmethod
    def from_input(cls, data: dict):
        payload = dict(data)
        if 'isActive' in payload and 'is_active' not in payload:
            payload['is_active'] = payload['isActive']
        return cls(**payload)


class PricingRuleItemSchema(BaseModel):
    """Individual pricing rule payload."""
    model_config = ConfigDict(populate_by_name=True)

    rule_type: str = Field(..., alias='ruleType')
    enabled: bool = Field(default=True)
    multiplier: float = Field(default=1.0, ge=0.1, le=10.0)
    start_time: Optional[str] = Field(default=None, alias='startTime')
    end_time: Optional[str] = Field(default=None, alias='endTime')
    discount: float = Field(default=0.0, ge=0.0, le=1.0)
    min_items: Optional[int] = Field(default=None, alias='minItems')
    apply_days: Optional[str] = Field(default=None, alias='applyDays')


class PricingRulesBulkUpdateSchema(BaseModel):
    """Bulk update payload for pricing rules."""
    rules: List[PricingRuleItemSchema]
