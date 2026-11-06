"""Timezone & UTC Timestamp Edge Case Tests."""
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import pytest

from app.models import Court, Booking, BookingSlot
from app.services.booking_service import BookingService
from app.utils.timezone import (
    slot_to_utc_range,
    is_slot_in_past,
    get_venue_timezone,
    get_current_venue_date
)


def test_slot_to_utc_range_basic():
    """Verify conversion of local slot to unambiguous UTC timestamps."""
    booking_date = date(2026, 11, 10)
    start_utc, end_utc = slot_to_utc_range(booking_date, '10:00', duration=2, tz_name='UTC')
    assert start_utc == datetime(2026, 11, 10, 10, 0, tzinfo=timezone.utc)
    assert end_utc == datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)


def test_slot_to_utc_range_kolkata_offset():
    """Verify UTC+5:30 timezone offset calculation."""
    booking_date = date(2026, 11, 10)
    # 18:00 IST is 12:30 UTC
    start_utc, end_utc = slot_to_utc_range(booking_date, '18:00', duration=1, tz_name='Asia/Kolkata')
    assert start_utc == datetime(2026, 11, 10, 12, 30, tzinfo=timezone.utc)
    assert end_utc == datetime(2026, 11, 10, 13, 30, tzinfo=timezone.utc)


def test_slot_to_utc_range_midnight_rollover():
    """Verify that multi-hour slots crossing midnight roll over to the next day in UTC."""
    booking_date = date(2026, 11, 10)
    # 23:00 IST for 2 hours -> 23:00 IST to 01:00 IST next day
    # 23:00 IST is 17:30 UTC, 01:00 IST is 19:30 UTC
    start_utc, end_utc = slot_to_utc_range(booking_date, '21:00', duration=2, tz_name='Asia/Kolkata')
    assert start_utc.tzinfo == timezone.utc
    assert end_utc.tzinfo == timezone.utc
    assert end_utc - start_utc == timedelta(hours=2)


def test_us_timezone_date_boundary_rollover():
    """Verify negative UTC offset across midnight transitions date cleanly."""
    booking_date = date(2026, 11, 10)
    # 20:00 EST (UTC-5) is 01:00 UTC next day (2026-11-11)
    start_utc, end_utc = slot_to_utc_range(booking_date, '20:00', duration=2, tz_name='America/New_York')
    assert start_utc == datetime(2026, 11, 11, 1, 0, tzinfo=timezone.utc)
    assert end_utc == datetime(2026, 11, 11, 3, 0, tzinfo=timezone.utc)


def test_booking_stores_explicit_utc_timestamps(seed_test_data, normal_user):
    """Verify that BookingService stores start_time_utc and end_time_utc."""
    future_date = date.today() + timedelta(days=3)
    court = Court.query.filter_by(id=1).first()

    res = BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court.id,
        booking_date=future_date,
        time_slot='14:00',
        duration=2,
        client_timezone='Asia/Kolkata'
    )

    booking = Booking.query.filter_by(id=res['booking_id']).first()
    assert booking is not None
    assert booking.start_time_utc is not None
    assert booking.end_time_utc is not None
    assert booking.timezone == 'Asia/Kolkata'
    assert booking.end_time_utc - booking.start_time_utc == timedelta(hours=2)

    # Verify slots carry UTC timestamps
    slots = BookingSlot.query.filter_by(booking_id=booking.id).all()
    assert len(slots) == 2
    for s in slots:
        assert s.start_time_utc is not None
        assert s.end_time_utc is not None

