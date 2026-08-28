"""Authentication & Authorization Test Suite."""
import pytest
from app.models.user import User


def test_user_registration_success(client, db_session):
    """Verify standard user registration flow."""
    response = client.post('/signup', json={
        'username': 'alice',
        'email': 'alice@example.com',
        'password': 'Password@123'
    })
    assert response.status_code == 201
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['username'] == 'alice'
    assert data['data']['is_admin'] is False

    user = User.query.filter_by(username='alice').first()
    assert user is not None
    assert user.check_password('Password@123') is True


def test_user_registration_duplicate_username(client, normal_user):
    """Verify duplicate username returns 409 Conflict."""
    response = client.post('/signup', json={
        'username': normal_user.username,
        'email': 'another@example.com',
        'password': 'Password@123'
    })
    assert response.status_code == 409
    data = response.get_json()
    assert data['success'] is False
    assert 'already taken' in data['message']


def test_user_registration_duplicate_email(client, normal_user):
    """Verify duplicate email returns 409 Conflict."""
    response = client.post('/signup', json={
        'username': 'anotheruser',
        'email': normal_user.email,
        'password': 'Password@123'
    })
    assert response.status_code == 409
    data = response.get_json()
    assert data['success'] is False
    assert 'already registered' in data['message']


def test_login_success(client, normal_user):
    """Verify login with correct credentials."""
    response = client.post('/login', json={
        'username': normal_user.username,
        'password': 'Secret@123'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['id'] == normal_user.id


def test_login_failure_invalid_password(client, normal_user):
    """Verify login with incorrect password returns 401."""
    response = client.post('/login', json={
        'username': normal_user.username,
        'password': 'WrongPassword'
    })
    assert response.status_code == 401
    data = response.get_json()
    assert data['success'] is False


def test_current_user_profile_endpoint(auth_client, normal_user):
    """Verify /me profile endpoint returns logged-in user data."""
    response = auth_client.get('/me')
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['data']['username'] == normal_user.username


def test_logout(auth_client):
    """Verify logout removes active session and redirects to login."""
    response = auth_client.get('/logout')
    assert response.status_code == 302
    assert '/login' in response.headers.get('Location', '')
    # Following request to /me should now fail
    me_resp = auth_client.get('/me')
    assert me_resp.status_code == 401
