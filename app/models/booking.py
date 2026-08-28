"""Booking Models & Enums."""
from datetime import datetime, timezone
from enum import Enum
from app.extensions import db


class BookingStatus(str, Enum):
    """Enumeration of possible booking statuses."""
    PENDING = 'pending'
    CONFIRMED = 'confirmed'
    CANCELLED = 'cancelled'
    COMPLETED = 'completed'


class Booking(db.Model):
    """Main Booking Reservation Model."""
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    court_id = db.Column(db.Integer, db.ForeignKey('courts.id', ondelete='RESTRICT'), nullable=False, index=True)
    coach_id = db.Column(db.Integer, db.ForeignKey('coaches.id', ondelete='SET NULL'), nullable=True, index=True)
    
    date = db.Column(db.Date, nullable=False, index=True)
    time_slot = db.Column(db.String(10), nullable=False)  # Starting time slot e.g. "08:00"
    duration = db.Column(db.Integer, default=1, nullable=False)  # Number of consecutive hours
    total_price = db.Column(db.Integer, nullable=False)  # Authoritative total computed server-side
    status = db.Column(db.String(20), default=BookingStatus.CONFIRMED.value, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = db.relationship('User', back_populates='bookings')
    court = db.relationship('Court', back_populates='bookings')
    coach = db.relationship('Coach', back_populates='bookings')
    equipment_items = db.relationship('BookingEquipment', back_populates='booking', cascade='all, delete-orphan', lazy='joined')
    slots = db.relationship('BookingSlot', back_populates='booking', cascade='all, delete-orphan', lazy='joined')

    __table_args__ = (
        db.Index('idx_bookings_user_date', 'user_id', 'date'),
        db.Index('idx_bookings_court_date_status', 'court_id', 'date', 'status'),
    )

    def to_dict(self) -> dict:
        """Convert booking to serializable dictionary."""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user': {
                'id': self.user.id,
                'username': self.user.username,
                'email': self.user.email
            } if self.user else None,
            'court_id': self.court_id,
            'court': self.court.to_dict() if self.court else None,
            'coach_id': self.coach_id,
            'coach': self.coach.to_dict() if self.coach else None,
            'date': self.date.strftime('%Y-%m-%d') if self.date else None,
            'time_slot': self.time_slot,
            'timeSlot': self.time_slot,  # Compatibility alias
            'duration': self.duration,
            'total_price': self.total_price,
            'totalPrice': self.total_price,  # Compatibility alias
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else None,
            'createdAt': self.created_at.strftime('%Y-%m-%d %H:%M') if self.created_at else None,
            'equipment': [item.to_dict() for item in self.equipment_items]
        }

    def __repr__(self) -> str:
        return f"<Booking #{self.id} Court:{self.court_id} Date:{self.date} Slot:{self.time_slot} Status:{self.status}>"


class BookingSlot(db.Model):
    """
    Explicit physical slot lock model to guarantee zero multi-hour race conditions
    at the database engine level via unique constraints.
    """
    __tablename__ = 'booking_slots'

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False, index=True)
    court_id = db.Column(db.Integer, db.ForeignKey('courts.id', ondelete='RESTRICT'), nullable=False)
    coach_id = db.Column(db.Integer, db.ForeignKey('coaches.id', ondelete='SET NULL'), nullable=True)
    date = db.Column(db.Date, nullable=False)
    time_slot = db.Column(db.String(10), nullable=False)  # Specific slot e.g. "09:00"

    # Relationships
    booking = db.relationship('Booking', back_populates='slots')

    __table_args__ = (
        db.UniqueConstraint('court_id', 'date', 'time_slot', name='uq_court_date_slot'),
        db.Index('idx_slots_lookup', 'court_id', 'date', 'time_slot'),
        db.Index('idx_coach_slots', 'coach_id', 'date', 'time_slot'),
    )

    def __repr__(self) -> str:
        return f"<BookingSlot Booking:{self.booking_id} Court:{self.court_id} {self.date} {self.time_slot}>"


class BookingEquipment(db.Model):
    """Equipments attached to a booking reservation."""
    __tablename__ = 'booking_equipment'

    id = db.Column(db.Integer, primary_key=True)
    booking_id = db.Column(db.Integer, db.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False, index=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id', ondelete='RESTRICT'), nullable=False, index=True)
    quantity = db.Column(db.Integer, nullable=False, default=1)

    # Relationships
    booking = db.relationship('Booking', back_populates='equipment_items')
    equipment = db.relationship('Equipment', back_populates='booking_items')

    def to_dict(self) -> dict:
        """Convert equipment line item to dictionary."""
        return {
            'id': self.id,
            'equipment_id': self.equipment_id,
            'name': self.equipment.name if self.equipment else 'Unknown',
            'quantity': self.quantity,
            'price': self.equipment.price if self.equipment else 0
        }

    def __repr__(self) -> str:
        return f"<BookingEquipment Booking:{self.booking_id} Eq:{self.equipment_id} Qty:{self.quantity}>"
