"""Application Configuration Module."""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


class BaseConfig:
    """Base configuration with shared defaults."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Security & Sessions
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = None  # Valid for session duration
    
    # Rate Limiting Defaults
    RATELIMIT_DEFAULT = "300 per day; 60 per hour"
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
    RATELIMIT_STRATEGY = 'fixed-window'

    # Admin bootstrap credentials (used for safe automated initialization)
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@courtbook.com')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin@123456')

    # SQLAlchemy Engine & Production Connection Pooling
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': int(os.environ.get('DB_POOL_SIZE', 5)),
        'max_overflow': int(os.environ.get('DB_MAX_OVERFLOW', 10)),
        'pool_timeout': 30,
        'pool_recycle': 300,  # Recycle connections every 5 min to prevent stale cloud DB drops
        'pool_pre_ping': True, # Test connection before issuing queries
    }

    # Static asset caching (24 hours)
    SEND_FILE_MAX_AGE_DEFAULT = 86400

    # Venue Timezone (enforces consistent UTC conversions)
    VENUE_TIMEZONE = os.environ.get('VENUE_TIMEZONE', 'Asia/Kolkata')

    # Flask-Compress settings
    COMPRESS_MIMETYPES = [
        'text/html',
        'text/css',
        'text/xml',
        'application/json',
        'application/javascript',
        'text/javascript'
    ]
    COMPRESS_LEVEL = 6
    COMPRESS_MIN_SIZE = 500



DEFAULT_DB_URL = "postgresql+psycopg2://postgres:postgrespassword@localhost:5432/courtbook"


def _normalize_db_url(url: str) -> str:
    if not url:
        return url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


class DevelopmentConfig(BaseConfig):
    """Development configuration enforcing PostgreSQL."""
    DEBUG = True
    TESTING = False
    SQLALCHEMY_DATABASE_URI = _normalize_db_url(
        os.environ.get('DATABASE_URL') or os.environ.get('SQLALCHEMY_DATABASE_URI') or DEFAULT_DB_URL
    )


class TestingConfig(BaseConfig):
    """Testing configuration supporting PostgreSQL container or in-memory fallback."""
    DEBUG = False
    TESTING = True
    SQLALCHEMY_DATABASE_URI = _normalize_db_url(
        os.environ.get('TEST_DATABASE_URL') or 'sqlite:///:memory:'
    )
    SQLALCHEMY_ENGINE_OPTIONS = {}
    WTF_CSRF_ENABLED = False
    RATELIMIT_ENABLED = False
    SECRET_KEY = 'test-secret-key'


class ProductionConfig(BaseConfig):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True  # Enforce HTTPS cookies in production
    
    SQLALCHEMY_DATABASE_URI = _normalize_db_url(
        os.environ.get('DATABASE_URL') or DEFAULT_DB_URL
    )


config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
