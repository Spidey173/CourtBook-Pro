"""Database Initialization Module (Bridge to app.extensions)."""
from app.extensions import db
from app.models import User, Court, Equipment, Coach, PricingRule


def init_db():
    """Create all database tables."""
    db.create_all()


def seed_data():
    """Seed initial courts, equipment, coaches, and pricing rules."""
    from cli import seed_data as cli_seed_data
    cli_seed_data()