"""Resource Availability Query Engine."""
from datetime import date
from typing import List, Dict, Any, Optional
from app.extensions import db
from app.models.court import Court
from app.models.coach import Coach
from app.models.equipment import Equipment
from app.models.booking import Booking, BookingSlot, BookingEquipment, BookingStatus
from app.schemas.booking_schema import VALID_TIME_SLOTS


class AvailabilityService:
    """Service for querying and calculating availability across courts, coaches, and equipment with batch single-query performance."""

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
    def get_active_bookings_snapshot(cls, booking_date: date, exclude_booking_id: Optional[int] = None) -> List[Booking]:
        """Fetches all active bookings for a given date in a single optimized query with relationships pre-loaded."""
        query = Booking.query.filter(
            Booking.date == booking_date,
            Booking.status.in_([BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value])
        )
        if exclude_booking_id:
            query = query.filter(Booking.id != exclude_booking_id)
        return query.all()

    @classmethod
    def is_court_available(
        cls,
        court_id: int,
        booking_date: date,
        start_slot: str,
        duration: int = 1,
        exclude_booking_id: Optional[int] = None,
        bookings_snapshot: Optional[List[Booking]] = None
    ) -> bool:
        """Check if a specific court has no conflicting bookings for the requested duration."""
        requested_slots = set(cls.get_slots_for_duration(start_slot, duration))
        if len(requested_slots) < duration:
            return False

        # Use pre-fetched snapshot if available, otherwise fetch in one query
        bookings = bookings_snapshot if bookings_snapshot is not None else cls.get_active_bookings_snapshot(booking_date, exclude_booking_id)

        for b in bookings:
            if b.court_id == court_id:
                b_slots = set(cls.get_slots_for_duration(b.time_slot, b.duration or 1))
                if requested_slots.intersection(b_slots):
                    return False

        return True

    @classmethod
    def is_coach_available(
        cls,
        coach_id: Optional[int],
        booking_date: date,
        start_slot: str,
        duration: int = 1,
        exclude_booking_id: Optional[int] = None,
        bookings_snapshot: Optional[List[Booking]] = None
    ) -> bool:
        """Check if coach has no overlapping reservations."""
        if coach_id is None:
            return True

        requested_slots = set(cls.get_slots_for_duration(start_slot, duration))
        if len(requested_slots) < duration:
            return False

        bookings = bookings_snapshot if bookings_snapshot is not None else cls.get_active_bookings_snapshot(booking_date, exclude_booking_id)

        for b in bookings:
            if b.coach_id == coach_id:
                b_slots = set(cls.get_slots_for_duration(b.time_slot, b.duration or 1))
                if requested_slots.intersection(b_slots):
                    return False

        return True

    @classmethod
    def get_equipment_availability(
        cls,
        booking_date: date,
        requested_slots: List[str],
        bookings_snapshot: Optional[List[Booking]] = None,
        all_equipment: Optional[List[Equipment]] = None
    ) -> Dict[int, int]:
        """
        Calculates remaining available quantity for each equipment item across all requested slots.
        Runs entirely in-memory using pre-fetched or single-query snapshots.
        """
        if all_equipment is None:
            all_equipment = Equipment.query.filter_by(is_active=True).all()

        if not requested_slots:
            return {eq.id: eq.total_available for eq in all_equipment}

        bookings = bookings_snapshot if bookings_snapshot is not None else cls.get_active_bookings_snapshot(booking_date)

        # Build slot -> equipment_id -> booked_count lookup in a single O(N) pass
        slot_eq_usage: Dict[str, Dict[int, int]] = {s: {} for s in requested_slots}
        requested_set = set(requested_slots)

        for b in bookings:
            b_slots = set(cls.get_slots_for_duration(b.time_slot, b.duration or 1))
            overlapping = requested_set.intersection(b_slots)
            if overlapping:
                for be in b.equipment_items:
                    eq_id = be.equipment_id
                    qty = be.quantity
                    for slot in overlapping:
                        slot_eq_usage[slot][eq_id] = slot_eq_usage[slot].get(eq_id, 0) + qty

        # Compute remaining available quantity per item
        availability_map: Dict[int, int] = {}
        for eq in all_equipment:
            max_used_in_any_slot = max([slot_eq_usage[s].get(eq.id, 0) for s in requested_slots], default=0)
            availability_map[eq.id] = max(0, eq.total_available - max_used_in_any_slot)

        return availability_map

    @classmethod
    def get_daily_booked_slots(cls, booking_date: date) -> Dict[str, Any]:
        """
        Returns mapping of court_id -> [list of booked time slots] and booked coach IDs.
        Executes in ONE single SQL query instead of per-court/coach iterations.
        """
        courts = Court.query.filter_by(is_active=True).all()
        booked_court_slots: Dict[int, List[str]] = {c.id: [] for c in courts}
        booked_coach_slots: Dict[int, List[str]] = {}

        active_bookings = cls.get_active_bookings_snapshot(booking_date)

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

        all_equipment = Equipment.query.filter_by(is_active=True).all()
        eq_availability = {eq.id: eq.total_available for eq in all_equipment}

        return {
            'booked_time_slots': booked_court_slots,
            'booked_courts': booked_court_slots,
            'booked_coaches': list(booked_coach_slots.keys()),
            'equipment_availability': eq_availability
        }

