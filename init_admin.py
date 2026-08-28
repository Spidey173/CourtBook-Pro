"""Database Initialization and Seeding Script (Wrapper for CLI)."""
import os
import sys

# Add directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db
from app.models import User, Court, Equipment, Coach, PricingRule

app = create_app('development')

with app.app_context():
    db.create_all()
    
    # 1. Seed courts
    if Court.query.count() == 0:
        courts = [
            Court(name='Court 1 - Indoor', type='indoor', base_price=600, is_active=True),
            Court(name='Court 2 - Indoor', type='indoor', base_price=600, is_active=True),
            Court(name='Court 3 - Outdoor', type='outdoor', base_price=400, is_active=True),
            Court(name='Court 4 - Outdoor', type='outdoor', base_price=400, is_active=True)
        ]
        db.session.add_all(courts)

    # 2. Seed equipment
    if Equipment.query.count() == 0:
        equipment = [
            Equipment(name='Badminton Racket', price=50, total_available=10, is_active=True),
            Equipment(name='Shuttlecocks (tube)', price=30, total_available=20, is_active=True),
            Equipment(name='Sports Shoes', price=100, total_available=8, is_active=True),
            Equipment(name='Sports Kit', price=150, total_available=5, is_active=True)
        ]
        db.session.add_all(equipment)

    # 3. Seed coaches
    if Coach.query.count() == 0:
        coaches = [
            Coach(name='Coach Rajesh', price=500, specialization='Advanced Training', is_active=True),
            Coach(name='Coach Priya', price=500, specialization='Beginners', is_active=True),
            Coach(name='Coach Amit', price=500, specialization='Tournament Prep', is_active=True)
        ]
        db.session.add_all(coaches)

    # 4. Seed pricing rules
    if PricingRule.query.count() == 0:
        pricing_rules = [
            PricingRule(rule_type='peak_hours', enabled=True, multiplier=1.5,
                       start_time='18:00', end_time='21:00', apply_days='1,2,3,4,5'),
            PricingRule(rule_type='weekend', enabled=True, multiplier=1.3),
            PricingRule(rule_type='indoor', enabled=True, multiplier=1.2),
            PricingRule(rule_type='multiple_hours', enabled=True, discount=0.10),
            PricingRule(rule_type='bundle', enabled=True, discount=0.15, min_items=3)
        ]
        db.session.add_all(pricing_rules)

    # 5. Create default Admin account if no admin exists
    admin_user = User.query.filter_by(is_admin=True).first()
    if not admin_user:
        admin_username = app.config.get('ADMIN_USERNAME', 'admin')
        admin_email = app.config.get('ADMIN_EMAIL', 'admin@courtbook.com')
        admin_pass = app.config.get('ADMIN_PASSWORD', 'Admin@123456')
        
        admin = User(
            username=admin_username,
            email=admin_email,
            is_admin=True,
            is_active=True
        )
        admin.set_password(admin_pass)
        db.session.add(admin)
        print(f"👑 Created default Administrator account: '{admin_username}' / '{admin_email}'")

    # 6. Create default Demo user account if no demo user exists
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
        print("👤 Created default Demo user account: 'demo_user' / 'demo@courtbook.com'")

    db.session.commit()
    print("✅ Database initialized and seeded successfully!")