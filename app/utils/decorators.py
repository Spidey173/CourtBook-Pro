"""Route & Controller Decorators."""
from functools import wraps
from flask import request, redirect, url_for, flash
from flask_login import current_user
from app.utils.responses import error_response


def admin_required(f):
    """
    Ensures that the requesting user is authenticated and has administrator privileges.
    Returns JSON 403 on API requests or redirects with flash message on HTML views.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            if request.is_json or request.path.startswith('/api/'):
                return error_response('Authentication required', status_code=401)
            return redirect(url_for('auth.login', next=request.url))
            
        if not current_user.is_admin:
            if request.is_json or request.path.startswith('/api/'):
                return error_response('Administrator privileges required', status_code=403)
            flash('You do not have permission to access the admin area.', 'danger')
            return redirect(url_for('main.home'))
            
        return f(*args, **kwargs)
    return decorated_function


def api_login_required(f):
    """
    Authentication decorator specifically tailored for JSON API endpoints.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return error_response('Authentication required', status_code=401)
        return f(*args, **kwargs)
    return decorated_function
