"""Authentication Blueprint Routes."""
from flask import Blueprint, render_template, redirect, url_for, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from flask_wtf.csrf import generate_csrf
from app.extensions import db, limiter
from app.models.user import User
from app.schemas.auth_schema import LoginSchema, RegisterSchema
from app.utils.responses import success_response, error_response
from app.utils.decorators import api_login_required

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/csrf-token', methods=['GET'])
def get_csrf_token():
    """Returns a fresh CSRF token for AJAX / JSON requests."""
    token = generate_csrf()
    return success_response(data={'csrf_token': token})


@auth_bp.route('/login', methods=['GET', 'POST'])
@limiter.limit("20 per minute", methods=['POST'])
def login():
    """User login endpoint supporting both HTML and JSON requests."""
    if current_user.is_authenticated:
        if request.is_json or request.headers.get('Accept') == 'application/json':
            return success_response(data=current_user.to_dict(), message="Already authenticated")
        if current_user.is_admin:
            return redirect(url_for('admin.admin_dashboard'))
        return redirect(url_for('main.home'))

    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form.to_dict()
        try:
            validated = LoginSchema(**data)
        except Exception as e:
            return error_response(f"Invalid input: {e}", status_code=422)

        user = User.query.filter(
            (User.username == validated.username) | (User.email == validated.username)
        ).first()

        if user and user.check_password(validated.password):
            if not user.is_active:
                return error_response("Your account has been deactivated. Please contact support.", status_code=403)
            
            login_user(user, remember=True)
            return success_response(
                data={
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'is_admin': user.is_admin,
                    'isAdmin': user.is_admin
                },
                message="Login successful"
            )
        else:
            return error_response("Invalid username or password", status_code=401)

    return render_template('login.html')


@auth_bp.route('/signup', methods=['GET', 'POST'])
@limiter.limit("10 per minute", methods=['POST'])
def signup():
    """User registration endpoint supporting both HTML and JSON requests."""
    if current_user.is_authenticated:
        if request.is_json or request.headers.get('Accept') == 'application/json':
            return success_response(data=current_user.to_dict(), message="Already authenticated")
        if current_user.is_admin:
            return redirect(url_for('admin.admin_dashboard'))
        return redirect(url_for('main.home'))


    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form.to_dict()
        try:
            validated = RegisterSchema(**data)
        except Exception as e:
            return error_response(f"Validation error: {e}", status_code=422)

        if User.query.filter_by(username=validated.username).first():
            return error_response("Username is already taken", status_code=409)

        if User.query.filter_by(email=validated.email).first():
            return error_response("Email address is already registered", status_code=409)

        # Standard users register as regular users (Admin creation is handled securely via CLI / env)
        user = User(
            username=validated.username,
            email=validated.email,
            is_admin=False,
            is_active=True
        )
        user.set_password(validated.password)

        db.session.add(user)
        db.session.commit()

        login_user(user, remember=True)
        return success_response(
            data={
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_admin': user.is_admin,
                'isAdmin': user.is_admin
            },
            message="Registration successful",
            status_code=201
        )

    return render_template('signup.html')


@auth_bp.route('/logout', methods=['GET', 'POST'])
def logout():
    """Logs out the current user, clears session, and redirects to login."""
    if current_user.is_authenticated:
        logout_user()
    if request.is_json:
        return success_response(message="Logged out successfully")
    response = redirect(url_for('auth.login'))
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0, private'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response



@auth_bp.route('/me', methods=['GET'])
@api_login_required
def get_current_user_profile():
    """Returns profile data of the currently authenticated user."""
    return success_response(data=current_user.to_dict())


@auth_bp.route('/demo-login', methods=['POST'])
def demo_login():
    """Endpoint for instant demo login (user or admin)."""
    from flask import current_app
    data = request.get_json(silent=True) or {}
    role = data.get('role', 'user')  # 'user' or 'admin'

    if role == 'admin':
        user = User.query.filter_by(is_admin=True).first()
        if not user:
            username = current_app.config.get('ADMIN_USERNAME', 'admin')
            admin_email = current_app.config.get('ADMIN_EMAIL', 'admin@courtbook.com')
            admin_pass = current_app.config.get('ADMIN_PASSWORD', 'Admin@123456')
            user = User(username=username, email=admin_email, is_admin=True, is_active=True)
            user.set_password(admin_pass)
            db.session.add(user)
            db.session.commit()
    else:
        user = User.query.filter_by(username='demo_user').first()
        if not user:
            user = User.query.filter_by(is_admin=False).first()
        if not user:
            user = User(username='demo_user', email='demo@courtbook.com', is_admin=False, is_active=True)
            user.set_password('Demo@123456')
            db.session.add(user)
            db.session.commit()

    if not user.is_active:
        user.is_active = True
        db.session.commit()

    login_user(user, remember=True)
    return success_response(
        data={
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin,
            'isAdmin': user.is_admin
        },
        message="Demo login successful"
    )


