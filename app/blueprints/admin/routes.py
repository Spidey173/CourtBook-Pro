"""Admin Web Views Blueprint."""
from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.utils.decorators import admin_required

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.route('/')
@login_required
@admin_required
def admin_dashboard():
    """Renders the administrative management dashboard."""
    return render_template('admin_dashboard.html', user=current_user)
