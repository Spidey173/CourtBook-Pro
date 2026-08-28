"""Court Model."""
from datetime import datetime, timezone
from app.extensions import db


class Court(db.Model):
    """Court resource model (indoor / outdoor)."""
    __tablename__ = 'courts'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    type = db.Column(db.String(20), nullable=False)  # 'indoor' or 'outdoor'
    base_price = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)  # Soft delete / availability toggle
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    bookings = db.relationship('Booking', back_populates='court', lazy='dynamic')

    def to_dict(self) -> dict:
        """Convert court to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'base_price': self.base_price,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self) -> str:
        return f"<Court {self.name} ({self.type})>"
