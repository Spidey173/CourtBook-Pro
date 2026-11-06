"""Main Application Web Views."""
import os
from flask import Blueprint, redirect, url_for, send_from_directory, current_app

main_bp = Blueprint('main', __name__)


def serve_spa():
    """Serves the decoupled modern React/TS Single-Page Application."""
    dist_dir = os.path.join(current_app.static_folder, 'dist')
    return send_from_directory(dist_dir, 'index.html')


@main_bp.route('/')
def home():
    """Renders the main customer booking interface."""
    return serve_spa()


@main_bp.route('/dashboard')
def dashboard():
    """Customer dashboard redirect."""
    return redirect(url_for('main.home'))
