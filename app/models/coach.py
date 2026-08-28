"""Coach Model."""
from datetime import datetime, timezone
from app.extensions import db


class Coach(db.Model):
    """Coach trainer model."""
    __tablename__ = 'coaches'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    price = db.Column(db.Integer, nullable=False)
    specialization = db.Column(db.String(200), default='', nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    bookings = db.relationship('Booking', back_populates='coach', lazy='dynamic')

    def to_dict(self) -> dict:
        """Convert coach to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'price': self.price,
            'specialization': self.specialization,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self) -> str:
        return f"<Coach {self.name} ({self.specialization})>"
