"""Resource Availability Query Engine."""
from datetime import date
from typing import List, Dict, Any, Optional
from sqlalchemy import func
from app.extensions import db
from app.models.court import Court
from app.models.coach import Coach
from app.models.equipment import Equipment
from app.models.booking import Booking, BookingSlot, BookingEquipment, BookingStatus
from app.schemas.booking_schema import VALID_TIME_SLOTS


class AvailabilityService:
    """Service for querying and calculating availability across courts, coaches, and equipment."""

    @staticmethod
    def get_slots_for_duration(start_slot: str, duration: int) -> List[str]:
        """Returns list of consecutive time slots for a given start slot and duration."""
        if start_slot not in VALID_TIME_SLOTS:
            return []
        start_idx = VALID_TIME_SLOTS.index(start_slot)
        if start_idx + duration > len(VALID_TIME_SLOTS):
            return []
        return VALID_TIME_SLOTS[start_idx : start_idx + duration]

    @classmethod
    def is_court_available(cls, court_id: int, booking_date: date, start_slot: str, duration: int = 1, exclude_booking_id: Optional[int] = None) -> bool:
        """Check if a specific court has no conflicting bookings for the requested duration."""
        requested_slots = cls.get_slots_for_duration(start_slot, duration)
        if len(requested_slots) < duration:
            return False

        # 1. Query booking_slots table for physical slot locks
        slot_query = db.session.query(BookingSlot).join(Booking).filter(
            BookingSlot.court_id == court_id,
            BookingSlot.date == booking_date,
            BookingSlot.time_slot.in_(requested_slots),
            Booking.status.in_([BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value])
        )
        if exclude_booking_id:
            slot_query = slot_query.filter(BookingSlot.booking_id != exclude_booking_id)

        if slot_query.first() is not None:
            return False

        # 2. Fallback check on bookings directly for legacy/non-slotted records
        existing_bookings = Booking.query.filter(
            Booking.court_id == court_id,
            Booking.date == booking_date,
            Booking.status.in_([BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value])
        )
        if exclude_booking_id:
            existing_bookings = existing_bookings.filter(Booking.id != exclude_booking_id)

        for b in existing_bookings.all():
            b_slots = cls.get_slots_for_duration(b.time_slot, b.duration or 1)
            if set(requested_slots).intersection(set(b_slots)):
                return False

        return True

    @classmethod
    def is_coach_available(cls, coach_id: Optional[int], booking_date: date, start_slot: str, duration: int = 1, exclude_booking_id: Optional[int] = None) -> bool:
        """Check if coach has no overlapping reservations."""
        if coach_id is None:
            return True

        requested_slots = cls.get_slots_for_duration(start_slot, duration)
        if len(requested_slots) < duration:
            return False

        # Check booking_slots
        slot_query = db.session.query(BookingSlot).join(Booking).filter(
            BookingSlot.coach_id == coach_id,
            BookingSlot.date == booking_date,
            BookingSlot.time_slot.in_(requested_slots),
            Booking.status.in_([BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value])
        )
        if exclude_booking_id:
            slot_query = slot_query.filter(BookingSlot.booking_id != exclude_booking_id)

        if slot_query.first() is not None:
            return False

        # Fallback check on bookings
        existing_bookings = Booking.query.filter(
            Booking.coach_id == coach_id,
            Booking.date == booking_date,
            Booking.status.in_([BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value])
        )
        if exclude_booking_id:
            existing_bookings = existing_bookings.filter(Booking.id != exclude_booking_id)

        for b in existing_bookings.all():
            b_slots = cls.get_slots_for_duration(b.time_slot, b.duration or 1)
            if set(requested_slots).intersection(set(b_slots)):
                return False

        return True

    @classmethod
    def get_equipment_availability(cls, booking_date: date, requested_slots: List[str]) -> Dict[int, int]:
        """
        Calculates remaining available quantity for each equipment item across all requested slots.
        """
        all_equipment = Equipment.query.filter_by(is_active=True).all()
        availability_map: Dict[int, int] = {}

        if not requested_slots:
            return {eq.id: eq.total_available for eq in all_equipment}

        # Find all active bookings on this date
        active_bookings = Booking.query.filter(
            Booking.date == booking_date,
            Booking.status.in_([BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value])
        ).all()

        for eq in all_equipment:
            min_available_across_slots = eq.total_available

            for slot in requested_slots:
                booked_for_slot = 0
                for booking in active_bookings:
                    b_slots = cls.get_slots_for_duration(booking.time_slot, booking.duration or 1)
                    if slot in b_slots:
                        for be in booking.equipment_items:
                            if be.equipment_id == eq.id:
                                booked_for_slot += be.quantity

                available_in_slot = max(0, eq.total_available - booked_for_slot)
                if available_in_slot < min_available_across_slots:
                    min_available_across_slots = available_in_slot

            availability_map[eq.id] = min_available_across_slots

        return availability_map

    @classmethod
    def get_daily_booked_slots(cls, booking_date: date) -> Dict[str, Any]:
        """
        Returns mapping of court_id -> [list of booked time slots] and booked coach IDs.
        Used by the frontend to render slot badges in real time.
        """
        courts = Court.query.filter_by(is_active=True).all()
        booked_court_slots: Dict[int, List[str]] = {c.id: [] for c in courts}
        booked_coach_slots: Dict[int, List[str]] = {}

        active_bookings = Booking.query.filter(
            Booking.date == booking_date,
            Booking.status.in_([BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value])
        ).all()

        for b in active_bookings:
            b_slots = cls.get_slots_for_duration(b.time_slot, b.duration or 1)
            if b.court_id in booked_court_slots:
                for s in b_slots:
                    if s not in booked_court_slots[b.court_id]:
                        booked_court_slots[b.court_id].append(s)

            if b.coach_id:
                if b.coach_id not in booked_coach_slots:
                    booked_coach_slots[b.coach_id] = []
                for s in b_slots:
                    if s not in booked_coach_slots[b.coach_id]:
                        booked_coach_slots[b.coach_id].append(s)

        # Also get general equipment availability for the day (or per hour)
        all_equipment = Equipment.query.filter_by(is_active=True).all()
        eq_availability = {eq.id: eq.total_available for eq in all_equipment}

        return {
            'booked_time_slots': booked_court_slots,
            'booked_courts': booked_court_slots,
            'booked_coaches': list(booked_coach_slots.keys()),
            'equipment_availability': eq_availability
        }
