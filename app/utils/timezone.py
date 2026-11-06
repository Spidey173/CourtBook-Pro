"""Timezone & UTC Timestamp Management Module.
Guarantees consistent, unambiguous UTC timestamp storage, timezone normalization,
and eliminates date-boundary rounding errors across timezones.
"""
import os
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from datetime import datetime, date, time, timezone, timedelta
from typing import Optional, Tuple

DEFAULT_VENUE_TIMEZONE = os.environ.get('VENUE_TIMEZONE', 'Asia/Kolkata')


def get_venue_timezone() -> ZoneInfo:
    """Returns configured venue timezone (defaults to Asia/Kolkata)."""
    try:
        return ZoneInfo(DEFAULT_VENUE_TIMEZONE)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo('UTC')


def get_current_venue_time() -> datetime:
    """Returns current datetime in the venue timezone."""
    return datetime.now(get_venue_timezone())


def get_current_venue_date() -> date:
    """Returns today's date according to the venue timezone."""
    return get_current_venue_time().date()


def get_current_utc_time() -> datetime:
    """Returns current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def slot_to_utc_range(
    booking_date: date,
    time_slot: str,
    duration: int = 1,
    tz_name: Optional[str] = None
) -> Tuple[datetime, datetime]:
    """
    Converts a local date and time_slot (e.g. '23:00') into unambiguous UTC start and end timestamps.
    Accurately handles midnight date transitions (e.g. 23:00 + 2h rolls over to the next day).
    """
    if tz_name:
        try:
            tz = ZoneInfo(tz_name)
        except (ZoneInfoNotFoundError, ValueError):
            tz = get_venue_timezone()
    else:
        tz = get_venue_timezone()

    hour, minute = map(int, time_slot.split(':'))
    local_start = datetime.combine(booking_date, time(hour, minute), tzinfo=tz)
    local_end = local_start + timedelta(hours=duration)
    return local_start.astimezone(timezone.utc), local_end.astimezone(timezone.utc)


def is_slot_in_past(
    booking_date: date,
    time_slot: str,
    tz_name: Optional[str] = None
) -> bool:
    """
    Checks if a slot has already started or elapsed by comparing strict UTC timestamps.
    Eliminates client-vs-server date-boundary offset bugs.
    """
    start_utc, _ = slot_to_utc_range(booking_date, time_slot, 1, tz_name)
    return start_utc < get_current_utc_time()

