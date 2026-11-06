"""Admin Web Views Blueprint."""
import os
from flask import Blueprint, send_from_directory, current_app
from flask_login import login_required, current_user
from app.utils.decorators import admin_required

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.route('/')
@login_required
@admin_required
def admin_dashboard():
    """Renders the administrative management dashboard."""
    dist_dir = os.path.join(current_app.static_folder, 'dist')
    return send_from_directory(dist_dir, 'index.html')
