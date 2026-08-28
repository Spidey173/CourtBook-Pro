"""Main Application Web Views."""
from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
@login_required
def home():
    """Renders the main customer booking interface."""
    return render_template('home.html', user=current_user)


@main_bp.route('/dashboard')
@login_required
def dashboard():
    """Customer dashboard redirect."""
    return redirect(url_for('main.home'))
