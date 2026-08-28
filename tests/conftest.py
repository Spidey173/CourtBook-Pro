"""Pytest Configuration & Fixtures."""
import pytest
from datetime import date, timedelta
from app import create_app
from app.extensions import db as _db
from app.models import User, Court, Equipment, Coach, PricingRule, Booking, BookingSlot, BookingEquipment


@pytest.fixture(scope='session')
def app():
    """Creates a testing instance of the application."""
    app = create_app('testing')
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture(scope='function')
def db_session(app):
    """Provides a transactional database session for each test function."""
    with app.app_context():
        _db.create_all()
        yield _db.session
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='function')
def client(app, db_session):
    """Provides an unauthenticated Flask test client."""
    return app.test_client()


@pytest.fixture(scope='function')
def seed_test_data(db_session):
    """Seeds standard courts, equipment, coaches, and pricing rules for tests."""
    courts = [
        Court(id=1, name='Court 1 - Indoor', type='indoor', base_price=600, is_active=True),
        Court(id=2, name='Court 2 - Indoor', type='indoor', base_price=600, is_active=True),
        Court(id=3, name='Court 3 - Outdoor', type='outdoor', base_price=400, is_active=True),
        Court(id=4, name='Court 4 - Outdoor', type='outdoor', base_price=400, is_active=True)
    ]
    equipment = [
        Equipment(id=1, name='Badminton Racket', price=50, total_available=10, is_active=True),
        Equipment(id=2, name='Shuttlecocks (tube)', price=30, total_available=20, is_active=True),
        Equipment(id=3, name='Sports Shoes', price=100, total_available=8, is_active=True)
    ]
    coaches = [
        Coach(id=1, name='Coach Rajesh', price=500, specialization='Advanced Training', is_active=True),
        Coach(id=2, name='Coach Priya', price=500, specialization='Beginners', is_active=True)
    ]
    pricing_rules = [
        PricingRule(
            id=1,
            rule_type='peak_hours',
            enabled=True,
            multiplier=1.5,
            start_time='18:00',
            end_time='21:00',
            apply_days='1,2,3,4,5'
        ),
        PricingRule(id=2, rule_type='weekend', enabled=True, multiplier=1.3),
        PricingRule(id=3, rule_type='indoor', enabled=True, multiplier=1.2),
        PricingRule(id=4, rule_type='multiple_hours', enabled=True, discount=0.10),
        PricingRule(id=5, rule_type='bundle', enabled=True, discount=0.15, min_items=3)
    ]

    _db.session.add_all(courts)
    _db.session.add_all(equipment)
    _db.session.add_all(coaches)
    _db.session.add_all(pricing_rules)
    _db.session.commit()

    return {
        'courts': courts,
        'equipment': equipment,
        'coaches': coaches,
        'pricing_rules': pricing_rules
    }


@pytest.fixture(scope='function')
def normal_user(db_session):
    """Creates a regular test user."""
    user = User(
        username='johndoe',
        email='john@example.com',
        is_admin=False,
        is_active=True
    )
    user.set_password('Secret@123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture(scope='function')
def admin_user(db_session):
    """Creates an administrator test user."""
    admin = User(
        username='adminuser',
        email='admin@example.com',
        is_admin=True,
        is_active=True
    )
    admin.set_password('AdminSecret@123')
    db_session.add(admin)
    db_session.commit()
    return admin


@pytest.fixture(scope='function')
def auth_client(client, normal_user):
    """Test client logged in as regular user."""
    with client.session_transaction() as sess:
        sess['_user_id'] = str(normal_user.id)
        sess['_fresh'] = True
    return client


@pytest.fixture(scope='function')
def admin_client(client, admin_user):
    """Test client logged in as admin user."""
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True
    return client
