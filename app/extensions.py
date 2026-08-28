"""Flask Extensions Module with Werkzeug 3+ backward compatibility."""
import sys
import urllib.parse
import werkzeug.urls

# Compatibility shim for older Flask-Login versions on Werkzeug 3+
if not hasattr(werkzeug.urls, 'url_decode'):
    def _shim_url_decode(s, charset='utf-8', **kwargs):
        parsed = urllib.parse.parse_qs(s, keep_blank_values=True, encoding=charset)
        return {k: v[0] if len(v) == 1 else v for k, v in parsed.items()}
    werkzeug.urls.url_decode = _shim_url_decode

if not hasattr(werkzeug.urls, 'url_quote'):
    werkzeug.urls.url_quote = urllib.parse.quote

if not hasattr(werkzeug.urls, 'url_quote_plus'):
    werkzeug.urls.url_quote_plus = urllib.parse.quote_plus

if not hasattr(werkzeug.urls, 'url_unquote'):
    werkzeug.urls.url_unquote = urllib.parse.unquote

from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate

try:
    from flask_compress import Compress
    compress = Compress()
except ImportError:
    class DummyCompress:
        def init_app(self, app):
            pass
    compress = DummyCompress()

db = SQLAlchemy()
login_manager = LoginManager()
csrf = CSRFProtect()
limiter = Limiter(key_func=get_remote_address)
migrate = Migrate()

