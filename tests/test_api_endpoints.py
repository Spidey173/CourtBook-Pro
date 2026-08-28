"""REST API Endpoints Test Suite."""
import pytest
from datetime import date, timedelta
from app.models import Court, Coach, Equipment, Booking


def test_healthz_endpoint(client):
    """Verify healthcheck endpoint."""
    response = client.get('/healthz')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'


def test_get_courts_api(auth_client, seed_test_data):
    """Verify GET /api/courts returns active courts."""
    response = auth_client.get('/api/courts')
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 4


def test_get_equipment_api(auth_client, seed_test_data):
    """Verify GET /api/equipment returns active equipment."""
    response = auth_client.get('/api/equipment')
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 3


def test_get_coaches_api(auth_client, seed_test_data):
    """Verify GET /api/coaches returns coaches."""
    response = auth_client.get('/api/coaches')
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2


def test_get_availability_api(auth_client, seed_test_data):
    """Verify GET /api/availability returns valid availability payload."""
    tomorrow = (date.today() + timedelta(days=1)).strftime('%Y-%m-%d')
    response = auth_client.get(f'/api/availability?date={tomorrow}&time_slot=10:00&duration=1')
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert len(data['data']['available_courts']) == 4


def test_create_booking_api_success(auth_client, seed_test_data):
    """Verify POST /api/bookings/create processes booking."""
    tomorrow = (date.today() + timedelta(days=1)).strftime('%Y-%m-%d')
    court = Court.query.first()

    response = auth_client.post('/api/bookings/create', json={
        'court_id': court.id,
        'date': tomorrow,
        'time_slot': '09:00',
        'duration': 1
    })
    assert response.status_code == 201
    data = response.get_json()
    assert data['success'] is True
    assert 'booking_id' in data


def test_create_booking_api_conflict(auth_client, seed_test_data):
    """Verify booking conflicting slot returns 409 Conflict."""
    tomorrow = (date.today() + timedelta(days=1)).strftime('%Y-%m-%d')
    court = Court.query.first()

    # 1. First booking
    auth_client.post('/api/bookings/create', json={
        'court_id': court.id,
        'date': tomorrow,
        'time_slot': '15:00',
        'duration': 1
    })

    # 2. Conflicting booking attempt
    response = auth_client.post('/api/bookings/create', json={
        'court_id': court.id,
        'date': tomorrow,
        'time_slot': '15:00',
        'duration': 1
    })
    assert response.status_code == 409
    data = response.get_json()
    assert data['success'] is False


def test_calculate_price_api(auth_client, seed_test_data):
    """Verify POST /api/calculate-price returns breakdown."""
    tomorrow = (date.today() + timedelta(days=1)).strftime('%Y-%m-%d')
    court = Court.query.first()

    response = auth_client.post('/api/calculate-price', json={
        'court_id': court.id,
        'date': tomorrow,
        'time_slot': '10:00',
        'duration': 2
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert 'total_price' in data['data']
    assert 'breakdown' in data['data']
