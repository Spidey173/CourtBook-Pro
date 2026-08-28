"""Pricing Rules Model."""
from datetime import datetime, timezone
from app.extensions import db


class PricingRule(db.Model):
    """Dynamic pricing configuration rule model."""
    __tablename__ = 'pricing_rules'

    id = db.Column(db.Integer, primary_key=True)
    rule_type = db.Column(db.String(50), unique=True, nullable=False, index=True)
    enabled = db.Column(db.Boolean, default=True, nullable=False)
    multiplier = db.Column(db.Float, default=1.0, nullable=False)
    start_time = db.Column(db.String(8), nullable=True)  # Format "18:00"
    end_time = db.Column(db.String(8), nullable=True)    # Format "21:00"
    discount = db.Column(db.Float, default=0.0, nullable=False)
    min_items = db.Column(db.Integer, nullable=True)
    apply_days = db.Column(db.String(50), nullable=True)  # "1,2,3,4,5"
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self) -> dict:
        """Convert pricing rule to dictionary."""
        return {
            'id': self.id,
            'rule_type': self.rule_type,
            'ruleType': self.rule_type,
            'enabled': self.enabled,
            'multiplier': self.multiplier,
            'start_time': self.start_time,
            'startTime': self.start_time,
            'end_time': self.end_time,
            'endTime': self.end_time,
            'discount': self.discount,
            'min_items': self.min_items,
            'minItems': self.min_items,
            'apply_days': self.apply_days,
            'applyDays': self.apply_days,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M') if self.updated_at else None,
            'updatedAt': self.updated_at.strftime('%Y-%m-%d %H:%M') if self.updated_at else None
        }

    def __repr__(self) -> str:
        return f"<PricingRule {self.rule_type} (Enabled: {self.enabled})>"
