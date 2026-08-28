"""Management CLI Commands."""
import os
import sys
import click
from app import create_app
from app.extensions import db
from app.models import User, Court, Equipment, Coach, PricingRule

app = create_app()


@click.group()
def cli():
    """Sports Court Booking Management CLI."""
    pass


@cli.command('init-db')
def init_db():
    """Initializes the database schema."""
    with app.app_context():
        db.create_all()
        click.secho("✅ Database tables created successfully!", fg='green')


@cli.command('seed-data')
def seed_data():
    """Seeds initial courts, equipment, coaches, and pricing rules."""
    with app.app_context():
        db.create_all()

        # Seed courts
        if Court.query.count() == 0:
            courts = [
                Court(name='Court 1 - Indoor', type='indoor', base_price=600, is_active=True),
                Court(name='Court 2 - Indoor', type='indoor', base_price=600, is_active=True),
                Court(name='Court 3 - Outdoor', type='outdoor', base_price=400, is_active=True),
                Court(name='Court 4 - Outdoor', type='outdoor', base_price=400, is_active=True)
            ]
            db.session.add_all(courts)
            click.echo("Seeded courts...")

        # Seed equipment
        if Equipment.query.count() == 0:
            equipment = [
                Equipment(name='Badminton Racket', price=50, total_available=10, is_active=True),
                Equipment(name='Shuttlecocks (tube)', price=30, total_available=20, is_active=True),
                Equipment(name='Sports Shoes', price=100, total_available=8, is_active=True),
                Equipment(name='Sports Kit', price=150, total_available=5, is_active=True)
            ]
            db.session.add_all(equipment)
            click.echo("Seeded equipment...")

        # Seed coaches
        if Coach.query.count() == 0:
            coaches = [
                Coach(name='Coach Rajesh', price=500, specialization='Advanced Training', is_active=True),
                Coach(name='Coach Priya', price=500, specialization='Beginners', is_active=True),
                Coach(name='Coach Amit', price=500, specialization='Tournament Prep', is_active=True)
            ]
            db.session.add_all(coaches)
            click.echo("Seeded coaches...")

        # Seed pricing rules
        if PricingRule.query.count() == 0:
            pricing_rules = [
                PricingRule(
                    rule_type='peak_hours',
                    enabled=True,
                    multiplier=1.5,
                    start_time='18:00',
                    end_time='21:00',
                    apply_days='1,2,3,4,5'
                ),
                PricingRule(rule_type='weekend', enabled=True, multiplier=1.3),
                PricingRule(rule_type='indoor', enabled=True, multiplier=1.2),
                PricingRule(rule_type='multiple_hours', enabled=True, discount=0.10),
                PricingRule(rule_type='bundle', enabled=True, discount=0.15, min_items=3)
            ]
            db.session.add_all(pricing_rules)
            click.echo("Seeded pricing rules...")

        # Seed default Demo User account if no demo user exists
        demo_user = User.query.filter_by(username='demo_user').first()
        if not demo_user:
            demo = User(
                username='demo_user',
                email='demo@courtbook.com',
                is_admin=False,
                is_active=True
            )
            demo.set_password('Demo@123456')
            db.session.add(demo)
            click.echo("Seeded default Demo user account (demo_user / Demo@123456)...")

        db.session.commit()
        click.secho("✅ Database seeding completed!", fg='green')


@cli.command('create-admin')
@click.option('--username', default=None, help='Admin username')
@click.option('--email', default=None, help='Admin email')
@click.option('--password', default=None, help='Admin password')
def create_admin(username, email, password):
    """Creates or elevates an administrator account."""
    with app.app_context():
        db.create_all()

        username = username or app.config.get('ADMIN_USERNAME', 'admin')
        email = email or app.config.get('ADMIN_EMAIL', 'admin@courtbook.com')
        password = password or app.config.get('ADMIN_PASSWORD', 'Admin@123456')

        user = User.query.filter((User.username == username) | (User.email == email)).first()
        if user:
            user.is_admin = True
            user.set_password(password)
            click.secho(f"✅ Updated existing user '{user.username}' as Administrator!", fg='yellow')
        else:
            user = User(
                username=username,
                email=email,
                is_admin=True,
                is_active=True
            )
            user.set_password(password)
            db.session.add(user)
            click.secho(f"✅ Created new Administrator account '{username}' ({email})!", fg='green')

        db.session.commit()


@cli.command('reset-db')
@click.confirmation_option(prompt='Are you sure you want to drop and recreate the database?')
def reset_db():
    """Drops and recreates all database tables."""
    with app.app_context():
        db.drop_all()
        db.create_all()
        click.secho("✅ Database reset successfully!", fg='yellow')


if __name__ == '__main__':
    cli()
