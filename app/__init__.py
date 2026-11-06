"""Application Factory."""
import os
from pathlib import Path
from flask import Flask, redirect, url_for, jsonify, request
from app.config import config_by_name, DevelopmentConfig
from app.extensions import db, login_manager, csrf, limiter, migrate, compress
from app.models.user import User
from app.utils.errors import register_error_handlers


def create_app(config_name: str = None) -> Flask:
    """Creates and configures an instance of the Flask application."""
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    base_dir = Path(__file__).resolve().parent.parent
    instance_path = base_dir / 'instance'
    try:
        instance_path.mkdir(exist_ok=True)
    except OSError:
        pass

    app = Flask(
        __name__,
        instance_path=str(instance_path),
        instance_relative_config=True,
        template_folder=str(base_dir / 'templates'),
        static_folder=str(base_dir / 'static')
    )

    # Load configuration
    config_cls = config_by_name.get(config_name, DevelopmentConfig)
    app.config.from_object(config_cls)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app)
    limiter.init_app(app)
    compress.init_app(app)

    @app.after_request
    def set_performance_headers(response):
        """Set optimal caching and compression headers based on content type."""
        # Static files (CSS/JS/images/fonts): Cache for 24 hours
        if request.path.startswith('/static/'):
            response.headers['Cache-Control'] = 'public, max-age=86400'
        else:
            # ALL HTML pages (including /admin and /) and API routes must never be stored in browser bfcache
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0, private'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        return response




    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Please log in to access this page.'
    login_manager.login_message_category = 'info'

    @login_manager.user_loader
    def load_user(user_id: str):
        return db.session.get(User, int(user_id))

    # Register error handlers
    register_error_handlers(app)

    # Register Blueprints
    from app.blueprints.auth import auth_bp
    from app.blueprints.main import main_bp
    from app.blueprints.admin import admin_bp
    from app.blueprints.api import api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(api_bp)

    # Backwards compatibility routes for legacy admin AJAX endpoints
    @app.route('/admin/api/dashboard/stats')
    def legacy_admin_stats():
        from app.blueprints.api.routes import get_admin_dashboard_stats
        return get_admin_dashboard_stats()

    @app.route('/admin/api/users', methods=['GET'])
    def legacy_admin_users():
        from app.blueprints.api.routes import get_admin_users
        return get_admin_users()

    @app.route('/admin/api/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
    def legacy_admin_user(user_id):
        from app.blueprints.api.routes import manage_admin_user
        return manage_admin_user(user_id)

    @app.route('/admin/api/bookings', methods=['GET'])
    def legacy_admin_bookings():
        from app.blueprints.api.routes import get_admin_bookings
        return get_admin_bookings()

    @app.route('/admin/api/bookings/<int:booking_id>/cancel', methods=['POST'])
    def legacy_admin_cancel_booking(booking_id):
        from app.blueprints.api.routes import cancel_booking_endpoint
        return cancel_booking_endpoint(booking_id)

    @app.route('/admin/api/courts', methods=['GET', 'POST'])
    def legacy_admin_courts():
        from app.blueprints.api.routes import manage_admin_courts
        return manage_admin_courts()

    @app.route('/admin/api/courts/<int:court_id>', methods=['PUT', 'DELETE'])
    def legacy_admin_court(court_id):
        from app.blueprints.api.routes import manage_single_court
        return manage_single_court(court_id)

    @app.route('/admin/api/equipment', methods=['GET', 'POST'])
    def legacy_admin_equipment():
        from app.blueprints.api.routes import manage_admin_equipment
        return manage_admin_equipment()

    @app.route('/admin/api/equipment/<int:equipment_id>', methods=['PUT', 'DELETE'])
    def legacy_admin_single_equipment(equipment_id):
        from app.blueprints.api.routes import manage_single_equipment
        return manage_single_equipment(equipment_id)

    @app.route('/admin/api/coaches', methods=['GET', 'POST'])
    def legacy_admin_coaches():
        from app.blueprints.api.routes import manage_admin_coaches
        return manage_admin_coaches()

    @app.route('/admin/api/coaches/<int:coach_id>', methods=['PUT', 'DELETE'])
    def legacy_admin_single_coach(coach_id):
        from app.blueprints.api.routes import manage_single_coach
        return manage_single_coach(coach_id)

    @app.route('/admin/api/pricing-rules', methods=['GET', 'PUT'])
    def legacy_admin_pricing_rules():
        from app.blueprints.api.routes import manage_admin_pricing_rules
        return manage_admin_pricing_rules()

    @app.route('/admin/api/reports/revenue', methods=['GET'])
    def legacy_admin_reports():
        from app.blueprints.api.routes import get_revenue_report_endpoint
        return get_revenue_report_endpoint()

    # Healthcheck endpoint
    @app.route('/healthz', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'environment': config_name
        }), 200

    if config_name != 'testing':
        with app.app_context():
            try:
                db.create_all()
                _init_default_data(app)
            except Exception as e:
                app.logger.warning("Database bootstrap skipped: %s", e)

    return app


def _init_default_data(app):
    """Seed initial courts, equipment, coaches, rules, and demo accounts if database is empty."""
    from app.models import Court, Coach, Equipment, PricingRule, User
    from sqlalchemy import text
    try:
        if Court.query.first() is None:
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
                PricingRule(id=1, rule_type='peak_hours', enabled=True, multiplier=1.5, start_time='18:00', end_time='21:00', apply_days='1,2,3,4,5'),
                PricingRule(id=2, rule_type='weekend', enabled=True, multiplier=1.3),
                PricingRule(id=3, rule_type='indoor', enabled=True, multiplier=1.2),
                PricingRule(id=4, rule_type='multiple_hours', enabled=True, discount=0.10),
                PricingRule(id=5, rule_type='bundle', enabled=True, discount=0.15, min_items=3)
            ]
            db.session.add_all(courts)
            db.session.add_all(equipment)
            db.session.add_all(coaches)
            db.session.add_all(pricing_rules)
            db.session.commit()
            for tbl in ['courts', 'equipment', 'coaches', 'pricing_rules']:
                try:
                    db.session.execute(text(f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), COALESCE((SELECT MAX(id) FROM {tbl}), 0) + 1, false)"))
                    db.session.commit()
                except Exception:
                    pass

        if User.query.filter_by(is_admin=True).first() is None:
            admin_user = User(username='admin', email='admin@courtbook.com', is_admin=True, is_active=True)
            admin_user.set_password('Admin@123456')
            db.session.add(admin_user)
            db.session.commit()

        if User.query.filter_by(username='demo_user').first() is None:
            demo_user = User(username='demo_user', email='demo@courtbook.com', is_admin=False, is_active=True)
            demo_user.set_password('Demo@123456')
            db.session.add(demo_user)
            db.session.commit()
    except Exception as err:
        db.session.rollback()
        app.logger.warning("Default data seeding skipped: %s", err)

