"""Pricing Engine Mathematical Test Suite."""
import pytest
from datetime import date, timedelta
from app.models.court import Court
from app.models.coach import Coach
from app.models.equipment import Equipment
from app.services.pricing_service import PricingService


def get_upcoming_weekday():
    """Finds next Monday."""
    d = date.today()
    while d.isoweekday() != 1:  # 1 = Monday
        d += timedelta(days=1)
    return d


def get_upcoming_saturday():
    """Finds next Saturday."""
    d = date.today()
    while d.isoweekday() != 6:  # 6 = Saturday
        d += timedelta(days=1)
    return d


def test_base_outdoor_weekday_standard_hours(seed_test_data):
    """Outdoor court (400 base) on weekday at 10:00 AM (no multipliers) = 400."""
    court = Court.query.filter_by(type='outdoor').first()
    weekday = get_upcoming_weekday()

    result = PricingService.calculate_price(
        court=court,
        booking_date=weekday,
        time_slot='10:00',
        duration=1
    )
    assert result['total_price'] == 400


def test_indoor_court_surcharge(seed_test_data):
    """Indoor court (600 base) on weekday 10:00 (1.2x indoor) = 720."""
    court = Court.query.filter_by(type='indoor').first()
    weekday = get_upcoming_weekday()

    result = PricingService.calculate_price(
        court=court,
        booking_date=weekday,
        time_slot='10:00',
        duration=1
    )
    assert result['total_price'] == 720  # 600 * 1.2


def test_peak_hours_multiplier(seed_test_data):
    """Outdoor court (400 base) on weekday 18:00 (1.5x peak) = 600."""
    court = Court.query.filter_by(type='outdoor').first()
    weekday = get_upcoming_weekday()

    result = PricingService.calculate_price(
        court=court,
        booking_date=weekday,
        time_slot='18:00',
        duration=1
    )
    assert result['total_price'] == 600  # 400 * 1.5


def test_weekend_multiplier(seed_test_data):
    """Outdoor court (400 base) on Saturday 10:00 (1.3x weekend) = 520."""
    court = Court.query.filter_by(type='outdoor').first()
    saturday = get_upcoming_saturday()

    result = PricingService.calculate_price(
        court=court,
        booking_date=saturday,
        time_slot='10:00',
        duration=1
    )
    assert result['total_price'] == 520  # 400 * 1.3


def test_stacked_multipliers_indoor_weekend(seed_test_data):
    """Indoor court (600 base) on Saturday (1.2x indoor * 1.3x weekend = 1.56x) = 936."""
    court = Court.query.filter_by(type='indoor').first()
    saturday = get_upcoming_saturday()

    result = PricingService.calculate_price(
        court=court,
        booking_date=saturday,
        time_slot='10:00',
        duration=1
    )
    # 600 * 1.2 * 1.3 = 936
    assert result['total_price'] == 936


def test_equipment_and_bundle_discount(seed_test_data):
    """Equipment 2 rackets (2*50=100) + 1 shuttlecock (30) = 130 total items 3 -> bundle 15% discount."""
    court = Court.query.filter_by(type='outdoor').first()
    weekday = get_upcoming_weekday()
    # 2 rackets (id=1) + 1 shuttlecock (id=2) = 3 items total
    equipment_req = {1: 2, 2: 1}

    result = PricingService.calculate_price(
        court=court,
        booking_date=weekday,
        time_slot='10:00',
        duration=1,
        equipment_requests=equipment_req
    )
    # Court: 400
    # Equipment: (50*2 + 30) = 130 - 15% (20) = 110
    # Total: 510
    assert result['total_price'] == 510


def test_coach_addition(seed_test_data):
    """Coach fee added to booking total."""
    court = Court.query.filter_by(type='outdoor').first()
    coach = Coach.query.first()  # 500
    weekday = get_upcoming_weekday()

    result = PricingService.calculate_price(
        court=court,
        booking_date=weekday,
        time_slot='10:00',
        duration=1,
        coach=coach
    )
    # Court (400) + Coach (500) = 900
    assert result['total_price'] == 900


def test_multi_hour_discount(seed_test_data):
    """Booking 2 hours applies 10% multi-hour discount."""
    court = Court.query.filter_by(type='outdoor').first()
    weekday = get_upcoming_weekday()

    result = PricingService.calculate_price(
        court=court,
        booking_date=weekday,
        time_slot='10:00',
        duration=2
    )
    # 2 hours * 400 = 800 - 10% (80) = 720
    assert result['total_price'] == 720
