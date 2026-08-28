"""Booking Transaction & Concurrency Test Suite."""
import pytest
from datetime import date, timedelta
from app.models import Court, Coach, Equipment, Booking, BookingSlot, BookingStatus
from app.services.booking_service import BookingService, BookingConflictError


def test_create_single_hour_booking(seed_test_data, normal_user):
    """Verify standard 1-hour booking creation."""
    tomorrow = date.today() + timedelta(days=1)
    court = Court.query.filter_by(type='indoor').first()

    result = BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court.id,
        booking_date=tomorrow,
        time_slot='10:00',
        duration=1
    )
    assert result['booking_id'] is not None
    assert result['total_price'] > 0

    # Verify physical slot lock in DB
    slot = BookingSlot.query.filter_by(court_id=court.id, date=tomorrow, time_slot='10:00').first()
    assert slot is not None
    assert slot.booking_id == result['booking_id']


def test_create_multi_hour_booking(seed_test_data, normal_user):
    """Verify multi-hour booking creates consecutive physical slot locks."""
    tomorrow = date.today() + timedelta(days=1)
    court = Court.query.filter_by(type='indoor').first()

    result = BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court.id,
        booking_date=tomorrow,
        time_slot='08:00',
        duration=3
    )
    assert result['booking_id'] is not None

    # Verify all 3 slots (08:00, 09:00, 10:00) are locked
    slots = BookingSlot.query.filter_by(court_id=court.id, date=tomorrow).order_by(BookingSlot.time_slot).all()
    assert len(slots) == 3
    assert [s.time_slot for s in slots] == ['08:00', '09:00', '10:00']


def test_double_booking_prevention_same_slot(seed_test_data, normal_user):
    """Verify attempting to book the exact same slot raises BookingConflictError."""
    tomorrow = date.today() + timedelta(days=1)
    court = Court.query.filter_by(type='indoor').first()

    # User 1 books
    BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court.id,
        booking_date=tomorrow,
        time_slot='14:00',
        duration=1
    )

    # User 2 attempts same slot
    with pytest.raises(BookingConflictError):
        BookingService.create_booking(
            user_id=normal_user.id,
            court_id=court.id,
            booking_date=tomorrow,
            time_slot='14:00',
            duration=1
        )


def test_double_booking_prevention_overlapping_multi_hour(seed_test_data, normal_user):
    """Verify booking overlapping with an active multi-hour reservation is blocked."""
    tomorrow = date.today() + timedelta(days=1)
    court = Court.query.filter_by(type='indoor').first()

    # User 1 books 08:00 to 11:00 (duration=3)
    BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court.id,
        booking_date=tomorrow,
        time_slot='08:00',
        duration=3
    )

    # User 2 attempts 09:00 (1 hour)
    with pytest.raises(BookingConflictError):
        BookingService.create_booking(
            user_id=normal_user.id,
            court_id=court.id,
            booking_date=tomorrow,
            time_slot='09:00',
            duration=1
        )

    # User 2 attempts 10:00 (2 hours: 10:00 and 11:00)
    with pytest.raises(BookingConflictError):
        BookingService.create_booking(
            user_id=normal_user.id,
            court_id=court.id,
            booking_date=tomorrow,
            time_slot='10:00',
            duration=2
        )


def test_coach_double_booking_prevention(seed_test_data, normal_user):
    """Verify same coach cannot be assigned to two different courts simultaneously."""
    tomorrow = date.today() + timedelta(days=1)
    court1 = Court.query.filter_by(id=1).first()
    court2 = Court.query.filter_by(id=2).first()
    coach = Coach.query.first()

    # Booking on Court 1 with Coach
    BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court1.id,
        booking_date=tomorrow,
        time_slot='11:00',
        duration=1,
        coach_id=coach.id
    )

    # Attempt booking on Court 2 with same Coach at same time -> blocked
    with pytest.raises(BookingConflictError):
        BookingService.create_booking(
            user_id=normal_user.id,
            court_id=court2.id,
            booking_date=tomorrow,
            time_slot='11:00',
            duration=1,
            coach_id=coach.id
        )


def test_equipment_inventory_exhaustion(seed_test_data, normal_user):
    """Verify requesting more equipment than available stock raises error."""
    tomorrow = date.today() + timedelta(days=1)
    court = Court.query.filter_by(id=1).first()
    racket = Equipment.query.filter_by(name='Badminton Racket').first()
    assert racket.total_available == 10

    # Requesting 15 rackets (more than 10 available)
    with pytest.raises(BookingConflictError):
        BookingService.create_booking(
            user_id=normal_user.id,
            court_id=court.id,
            booking_date=tomorrow,
            time_slot='12:00',
            duration=1,
            equipment_requests={racket.id: 15}
        )


def test_booking_cancellation_releases_slot(seed_test_data, normal_user):
    """Verify cancelling a booking immediately frees up the slot for other users."""
    tomorrow = date.today() + timedelta(days=1)
    court = Court.query.filter_by(id=1).first()

    # Create booking
    result = BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court.id,
        booking_date=tomorrow,
        time_slot='16:00',
        duration=1
    )
    booking_id = result['booking_id']

    # Cancel booking
    BookingService.cancel_booking(booking_id=booking_id, user_id=normal_user.id)

    booking = Booking.query.get(booking_id)
    assert booking.status == BookingStatus.CANCELLED.value

    # Check slot lock is removed
    slot = BookingSlot.query.filter_by(booking_id=booking_id).first()
    assert slot is None

    # Now someone else can book that exact slot successfully
    new_result = BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court.id,
        booking_date=tomorrow,
        time_slot='16:00',
        duration=1
    )
    assert new_result['booking_id'] is not None
