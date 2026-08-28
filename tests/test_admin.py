"""Admin Management & Analytics Test Suite."""
import pytest
from datetime import date, timedelta
from app.models import Court, Coach, Equipment, PricingRule, User, Booking
from app.services.booking_service import BookingService


def test_admin_route_unauthorized_for_normal_user(auth_client):
    """Verify regular user receives 403 Forbidden accessing admin endpoints."""
    response = auth_client.get('/api/admin/stats')
    assert response.status_code == 403


def test_admin_dashboard_stats(admin_client, seed_test_data, normal_user):
    """Verify admin stats calculation."""
    tomorrow = date.today() + timedelta(days=1)
    court = Court.query.first()
    BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court.id,
        booking_date=tomorrow,
        time_slot='10:00',
        duration=1
    )

    response = admin_client.get('/api/admin/stats')
    assert response.status_code == 200
    data = response.get_json()
    assert data['totalBookings'] >= 1
    assert data['totalRevenue'] > 0


def test_admin_court_crud(admin_client, seed_test_data):
    """Verify court creation, update, and soft deletion by admin."""
    # 1. Create Court
    create_resp = admin_client.post('/api/admin/courts', json={
        'name': 'Court 5 - Premium Indoor',
        'type': 'indoor',
        'basePrice': 800,
        'isActive': True
    })
    assert create_resp.status_code == 201
    court_id = create_resp.get_json()['data']['id']

    # 2. Update Court
    update_resp = admin_client.put(f'/api/admin/courts/{court_id}', json={
        'basePrice': 850
    })
    assert update_resp.status_code == 200
    court = Court.query.get(court_id)
    assert court.base_price == 850

    # 3. Soft Delete Court
    del_resp = admin_client.delete(f'/api/admin/courts/{court_id}')
    assert del_resp.status_code == 200
    court = Court.query.get(court_id)
    assert court.is_active is False


def test_admin_equipment_crud(admin_client, seed_test_data):
    """Verify equipment CRUD operations."""
    create_resp = admin_client.post('/api/admin/equipment', json={
        'name': 'Tournament Shuttlecocks',
        'price': 40,
        'totalAvailable': 30
    })
    assert create_resp.status_code == 201
    eq_id = create_resp.get_json()['data']['id']

    # Update
    admin_client.put(f'/api/admin/equipment/{eq_id}', json={'totalAvailable': 35})
    eq = Equipment.query.get(eq_id)
    assert eq.total_available == 35


def test_admin_coach_crud(admin_client, seed_test_data):
    """Verify coach CRUD operations."""
    create_resp = admin_client.post('/api/admin/coaches', json={
        'name': 'Coach Saina',
        'price': 700,
        'specialization': 'Singles Pro'
    })
    assert create_resp.status_code == 201
    coach_id = create_resp.get_json()['data']['id']

    admin_client.put(f'/api/admin/coaches/{coach_id}', json={'price': 750})
    coach = Coach.query.get(coach_id)
    assert coach.price == 750


def test_admin_pricing_rules_update(admin_client, seed_test_data):
    """Verify bulk updating pricing rules."""
    response = admin_client.put('/api/admin/pricing-rules', json={
        'rules': [
            {
                'ruleType': 'peak_hours',
                'multiplier': 1.8,
                'startTime': '17:00',
                'endTime': '22:00'
            }
        ]
    })
    assert response.status_code == 200
    rule = PricingRule.query.filter_by(rule_type='peak_hours').first()
    assert rule.multiplier == 1.8
    assert rule.start_time == '17:00'


def test_admin_revenue_report(admin_client, seed_test_data, normal_user):
    """Verify revenue analytics query works cleanly."""
    tomorrow = date.today() + timedelta(days=1)
    court = Court.query.first()
    BookingService.create_booking(
        user_id=normal_user.id,
        court_id=court.id,
        booking_date=tomorrow,
        time_slot='10:00',
        duration=1
    )

    response = admin_client.get('/api/admin/reports/revenue')
    assert response.status_code == 200
    data = response.get_json()
    assert 'totalRevenue' in data
    assert 'revenueByCourt' in data
    assert 'topUsers' in data
