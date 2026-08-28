"""Equipment Model."""
from datetime import datetime, timezone
from app.extensions import db


class Equipment(db.Model):
    """Equipment inventory model (rackets, shoes, shuttlecocks, etc.)."""
    __tablename__ = 'equipment'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False, index=True)
    price = db.Column(db.Integer, nullable=False)
    total_available = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    booking_items = db.relationship('BookingEquipment', back_populates='equipment', lazy='dynamic')

    def to_dict(self) -> dict:
        """Convert equipment to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'price': self.price,
            'total_available': self.total_available,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self) -> str:
        return f"<Equipment {self.name} (Qty: {self.total_available})>"
