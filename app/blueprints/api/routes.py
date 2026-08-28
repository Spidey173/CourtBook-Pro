"""Unified RESTful API Controller."""
import logging
from datetime import datetime, date
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from app.extensions import db
from app.models.user import User
from app.models.court import Court
from app.models.equipment import Equipment
from app.models.coach import Coach
from app.models.booking import Booking, BookingEquipment, BookingSlot, BookingStatus
from app.models.pricing_rule import PricingRule
from app.schemas.booking_schema import (
    BookingCreateSchema,
    PriceCalculateSchema,
    AvailabilityQuerySchema,
    VALID_TIME_SLOTS
)
from app.schemas.admin_schema import (
    CourtCreateUpdateSchema,
    EquipmentCreateUpdateSchema,
    CoachCreateUpdateSchema,
    PricingRulesBulkUpdateSchema
)
from app.services.pricing_service import PricingService
from app.services.availability_service import AvailabilityService
from app.services.booking_service import BookingService, BookingConflictError, BookingNotFoundError
from app.services.analytics_service import AnalyticsService
from app.utils.decorators import admin_required, api_login_required
from app.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__, url_prefix='/api')


# ==========================================
# 1. Public & Core Resource Endpoints
# ==========================================

@api_bp.route('/courts', methods=['GET'])
@api_bp.route('/v1/courts', methods=['GET'])
@api_login_required
def get_courts():
    """Returns list of all active courts."""
    courts = Court.query.filter_by(is_active=True).order_by(Court.id).all()
    # Support both raw list and envelope
    return jsonify([c.to_dict() for c in courts])


@api_bp.route('/equipment', methods=['GET'])
@api_bp.route('/v1/equipment', methods=['GET'])
@api_login_required
def get_equipment():
    """Returns list of all active equipment items."""
    equipment = Equipment.query.filter_by(is_active=True).order_by(Equipment.id).all()
    return jsonify([{
        'id': eq.id,
        'name': eq.name,
        'price': eq.price,
        'available': eq.total_available,
        'total_available': eq.total_available,
        'is_active': eq.is_active
    } for eq in equipment])


@api_bp.route('/coaches', methods=['GET'])
@api_bp.route('/v1/coaches', methods=['GET'])
@api_login_required
def get_coaches():
    """Returns list of all active coaches."""
    coaches = Coach.query.filter_by(is_active=True).order_by(Coach.id).all()
    return jsonify([c.to_dict() for c in coaches])


@api_bp.route('/timeslots', methods=['GET'])
@api_bp.route('/v1/timeslots', methods=['GET'])
@api_login_required
def get_timeslots():
    """Returns standard available time slots."""
    return jsonify(VALID_TIME_SLOTS)


@api_bp.route('/pricing_rules', methods=['GET'])
@api_bp.route('/pricing-rules', methods=['GET'])
@api_bp.route('/v1/pricing-rules', methods=['GET'])
@api_login_required
def get_pricing_rules():
    """Returns enabled pricing rules formatted for dynamic calculations."""
    rules = PricingRule.query.filter_by(enabled=True).all()
    rules_dict = {}
    for rule in rules:
        if rule.rule_type == 'peak_hours':
            rules_dict['peakHours'] = {
                'enabled': rule.enabled,
                'multiplier': rule.multiplier,
                'start': rule.start_time or '18:00',
                'end': rule.end_time or '21:00',
                'applyDays': rule.apply_days
            }
        elif rule.rule_type == 'weekend':
            rules_dict['weekend'] = {
                'enabled': rule.enabled,
                'multiplier': rule.multiplier
            }
        elif rule.rule_type == 'indoor':
            rules_dict['indoor'] = {
                'enabled': rule.enabled,
                'multiplier': rule.multiplier
            }
        elif rule.rule_type == 'multiple_hours':
            rules_dict['multipleHours'] = {
                'enabled': rule.enabled,
                'discountPerHour': rule.discount,
                'discount': rule.discount
            }
        elif rule.rule_type == 'bundle':
            rules_dict['bundle'] = {
                'enabled': rule.enabled,
                'discount': rule.discount,
                'minItems': rule.min_items or 3
            }

    return jsonify(rules_dict)


# ==========================================
# 2. Availability & Price Calculation Endpoints
# ==========================================

@api_bp.route('/availability', methods=['GET'])
@api_bp.route('/v1/availability', methods=['GET'])
@api_login_required
def get_availability():
    """Detailed availability query for court, equipment, and coaches."""
    try:
        query_data = {
            'date': request.args.get('date'),
            'time_slot': request.args.get('time_slot') or request.args.get('timeSlot'),
            'duration': int(request.args.get('duration', 1))
        }
        validated = AvailabilityQuerySchema(**query_data)
    except Exception as e:
        return error_response(f"Invalid query parameters: {e}", status_code=400)

    time_slot = validated.time_slot or '06:00'
    consecutive_slots = AvailabilityService.get_slots_for_duration(time_slot, validated.duration)

    # Active courts
    courts = Court.query.filter_by(is_active=True).all()
    available_courts = [
        c.to_dict() for c in courts
        if AvailabilityService.is_court_available(c.id, validated.date, time_slot, validated.duration)
    ]

    # Active coaches
    coaches = Coach.query.filter_by(is_active=True).all()
    available_coaches = [
        c.to_dict() for c in coaches
        if AvailabilityService.is_coach_available(c.id, validated.date, time_slot, validated.duration)
    ]

    # Equipment inventory
    equipment_map = AvailabilityService.get_equipment_availability(validated.date, consecutive_slots)

    return success_response(data={
        'available_courts': available_courts,
        'available_coaches': available_coaches,
        'equipment_availability': equipment_map,
        'slots_checked': consecutive_slots
    })


@api_bp.route('/check_availability', methods=['GET'])
@api_bp.route('/v1/check-availability', methods=['GET'])
@api_login_required
def check_availability_legacy():
    """Returns booked slot mappings for date (compatible with frontend calendar view)."""
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({})

    try:
        query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return error_response("Invalid date format. Expected YYYY-MM-DD", status_code=400)

    result = AvailabilityService.get_daily_booked_slots(query_date)
    return jsonify(result)


@api_bp.route('/calculate-price', methods=['POST'])
@api_bp.route('/v1/calculate-price', methods=['POST'])
@api_login_required
def calculate_price_endpoint():
    """Computes authoritative price estimate without booking."""
    data = request.get_json(silent=True) or {}
    try:
        validated = PriceCalculateSchema(**data)
    except Exception as e:
        return error_response(f"Invalid pricing query payload: {e}", status_code=422)

    court = db.session.get(Court, validated.court_id)
    if not court:
        return error_response("Court not found", status_code=404)

    coach = db.session.get(Coach, validated.coach_id) if validated.coach_id else None

    # Clean equipment dict
    cleaned_equip = {int(k): int(v) for k, v in validated.equipment.items() if int(v) > 0}

    price_result = PricingService.calculate_price(
        court=court,
        booking_date=validated.date,
        time_slot=validated.time_slot,
        duration=validated.duration,
        coach=coach,
        equipment_requests=cleaned_equip
    )
    return success_response(data=price_result)


# ==========================================
# 3. User Bookings Endpoints
# ==========================================

@api_bp.route('/bookings', methods=['GET'])
@api_bp.route('/v1/bookings', methods=['GET'])
@api_login_required
def get_user_bookings():
    """Returns booking history for the current authenticated user."""
    status_filter = request.args.get('status')
    query = Booking.query.filter_by(user_id=current_user.id)
    if status_filter:
        query = query.filter_by(status=status_filter)

    bookings = query.order_by(Booking.date.desc(), Booking.time_slot.desc()).all()
    booking_dicts = [b.to_dict() for b in bookings]
    return jsonify(booking_dicts)


@api_bp.route('/bookings', methods=['POST'])
@api_bp.route('/bookings/create', methods=['POST'])
@api_bp.route('/v1/bookings', methods=['POST'])
@api_login_required
def create_booking_endpoint():
    """Creates a new booking with physical slot locking and server-calculated pricing."""
    data = request.get_json(silent=True) or {}
    try:
        validated = BookingCreateSchema(**data)
    except Exception as e:
        return error_response(f"Validation failed: {e}", status_code=422)

    try:
        booking_result = BookingService.create_booking(
            user_id=current_user.id,
            court_id=validated.court_id,
            booking_date=validated.date,
            time_slot=validated.time_slot,
            duration=validated.duration,
            coach_id=validated.coach_id,
            equipment_requests=validated.equipment
        )
        return success_response(
            data=booking_result,
            message="Booking confirmed successfully",
            status_code=201,
            booking_id=booking_result['booking_id']  # Top-level key for backwards compatibility
        )
    except BookingConflictError as bce:
        return error_response(str(bce), status_code=409)
    except ValueError as ve:
        return error_response(str(ve), status_code=400)
    except Exception as e:
        logger.exception("Booking creation failed: %s", e)
        return error_response("Internal server error during booking creation", status_code=500)


@api_bp.route('/bookings/<int:booking_id>/cancel', methods=['POST'])
@api_bp.route('/v1/bookings/<int:booking_id>/cancel', methods=['POST'])
@api_login_required
def cancel_booking_endpoint(booking_id: int):
    """Cancels a booking and frees its slot locks."""
    try:
        BookingService.cancel_booking(
            booking_id=booking_id,
            user_id=current_user.id,
            is_admin=current_user.is_admin
        )
        return success_response(message="Booking cancelled successfully")
    except BookingNotFoundError:
        return error_response("Booking not found", status_code=404)
    except PermissionError:
        return error_response("Access forbidden", status_code=403)
    except ValueError as ve:
        return error_response(str(ve), status_code=400)


@api_bp.route('/bookings/<int:booking_id>', methods=['DELETE'])
@api_bp.route('/v1/bookings/<int:booking_id>', methods=['DELETE'])
@api_login_required
def delete_booking_endpoint(booking_id: int):
    """Deletes or cancels a booking."""
    return cancel_booking_endpoint(booking_id)


# ==========================================
# 4. Admin Management Endpoints
# ==========================================

@api_bp.route('/admin/stats', methods=['GET'])
@api_bp.route('/v1/admin/stats', methods=['GET'])
@admin_required
def get_admin_dashboard_stats():
    """Returns analytics and dashboard statistics for admin."""
    stats = AnalyticsService.get_dashboard_summary()
    return jsonify(stats)


@api_bp.route('/admin/users', methods=['GET'])
@api_bp.route('/v1/admin/users', methods=['GET'])
@admin_required
def get_admin_users():
    """Paginated user administration list."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '').strip()

    query = User.query
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )

    users_page = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'users': [{
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'isAdmin': u.is_admin,
            'isActive': u.is_active,
            'createdAt': u.created_at.strftime('%Y-%m-%d %H:%M') if u.created_at else None,
            'totalBookings': Booking.query.filter_by(user_id=u.id).count()
        } for u in users_page.items],
        'total': users_page.total,
        'page': users_page.page,
        'per_page': users_page.per_page,
        'pages': users_page.pages
    })


@api_bp.route('/admin/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
@api_bp.route('/v1/admin/users/<int:user_id>', methods=['GET', 'PUT', 'DELETE'])
@admin_required
def manage_admin_user(user_id: int):
    """View, update or deactivate an individual user."""
    user = User.query.get_or_404(user_id)

    if request.method == 'GET':
        user_bookings = Booking.query.filter_by(user_id=user.id).order_by(Booking.date.desc()).all()
        return jsonify({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'isAdmin': user.is_admin,
            'isActive': user.is_active,
            'createdAt': user.created_at.strftime('%Y-%m-%d %H:%M') if user.created_at else None,
            'bookings': [b.to_dict() for b in user_bookings],
            'totalSpent': sum(b.total_price for b in user_bookings if b.status != BookingStatus.CANCELLED.value)
        })

    elif request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        if user.id == current_user.id and data.get('isAdmin') is False:
            admin_count = User.query.filter_by(is_admin=True, is_active=True).count()
            if admin_count <= 1:
                return error_response("Cannot revoke your own admin rights as the sole active administrator", status_code=400)

        if 'username' in data and data['username'] != user.username:
            if User.query.filter(User.username == data['username'], User.id != user.id).first():
                return error_response("Username already exists", status_code=409)
            user.username = data['username']

        if 'email' in data and data['email'] != user.email:
            if User.query.filter(User.email == data['email'], User.id != user.id).first():
                return error_response("Email already registered", status_code=409)
            user.email = data['email']

        if 'isAdmin' in data:
            user.is_admin = bool(data['isAdmin'])
        if 'isActive' in data:
            user.is_active = bool(data['isActive'])

        db.session.commit()
        return success_response(message="User updated successfully")

    elif request.method == 'DELETE':
        if user.id == current_user.id:
            return error_response("Cannot delete or deactivate your own active account", status_code=400)

        # Soft deactivate user
        user.is_active = False
        db.session.commit()
        return success_response(message="User deactivated successfully")


@api_bp.route('/admin/bookings', methods=['GET'])
@api_bp.route('/v1/admin/bookings', methods=['GET'])
@admin_required
def get_admin_bookings():
    """Paginated list of all center bookings with filters."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    status_filter = request.args.get('status', 'all')
    date_filter = request.args.get('date', '')
    search = request.args.get('search', '').strip()

    query = Booking.query.join(User).join(Court)

    if status_filter == 'upcoming':
        query = query.filter(Booking.date >= date.today(), Booking.status != BookingStatus.CANCELLED.value)
    elif status_filter == 'past':
        query = query.filter(Booking.date < date.today(), Booking.status != BookingStatus.CANCELLED.value)
    elif status_filter == 'cancelled':
        query = query.filter(Booking.status == BookingStatus.CANCELLED.value)

    if date_filter:
        try:
            d = datetime.strptime(date_filter, '%Y-%m-%d').date()
            query = query.filter(Booking.date == d)
        except ValueError:
            pass

    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) | (Court.name.ilike(f"%{search}%"))
        )

    bookings_page = query.order_by(Booking.date.desc(), Booking.time_slot.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'bookings': [b.to_dict() for b in bookings_page.items],
        'total': bookings_page.total,
        'page': bookings_page.page,
        'per_page': bookings_page.per_page,
        'pages': bookings_page.pages
    })


@api_bp.route('/admin/courts', methods=['GET', 'POST'])
@api_bp.route('/v1/admin/courts', methods=['GET', 'POST'])
@admin_required
def manage_admin_courts():
    """List all courts (including inactive) or add a new court."""
    if request.method == 'GET':
        courts = Court.query.order_by(Court.id).all()
        return jsonify([{
            'id': c.id,
            'name': c.name,
            'type': c.type,
            'basePrice': c.base_price,
            'base_price': c.base_price,
            'isActive': c.is_active,
            'is_active': c.is_active,
            'createdAt': c.created_at.strftime('%Y-%m-%d'),
            'totalBookings': Booking.query.filter_by(court_id=c.id).count()
        } for c in courts])

    elif request.method == 'POST':
        data = request.get_json(silent=True) or {}
        try:
            validated = CourtCreateUpdateSchema.from_input(data)
        except Exception as e:
            return error_response(f"Validation error: {e}", status_code=422)

        if Court.query.filter_by(name=validated.name).first():
            return error_response("Court with this name already exists", status_code=409)

        court = Court(
            name=validated.name,
            type=validated.type,
            base_price=validated.base_price,
            is_active=validated.is_active
        )
        db.session.add(court)
        db.session.commit()
        return success_response(data=court.to_dict(), message="Court added successfully", status_code=201)


@api_bp.route('/admin/courts/<int:court_id>', methods=['PUT', 'DELETE'])
@api_bp.route('/v1/admin/courts/<int:court_id>', methods=['PUT', 'DELETE'])
@admin_required
def manage_single_court(court_id: int):
    """Update or soft-delete a court."""
    court = Court.query.get_or_404(court_id)

    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        if 'name' in data and data['name'] != court.name:
            if Court.query.filter(Court.name == data['name'], Court.id != court.id).first():
                return error_response("Court name already exists", status_code=409)
            court.name = data['name']

        if 'type' in data:
            court.type = data['type']
        if 'basePrice' in data or 'base_price' in data:
            court.base_price = int(data.get('basePrice') or data.get('base_price'))
        if 'isActive' in data or 'is_active' in data:
            court.is_active = bool(data.get('isActive') if 'isActive' in data else data.get('is_active'))

        db.session.commit()
        return success_response(data=court.to_dict(), message="Court updated successfully")

    elif request.method == 'DELETE':
        # Soft delete
        court.is_active = False
        db.session.commit()
        return success_response(message="Court deactivated successfully")


@api_bp.route('/admin/equipment', methods=['GET', 'POST'])
@api_bp.route('/v1/admin/equipment', methods=['GET', 'POST'])
@admin_required
def manage_admin_equipment():
    """List or create equipment items."""
    if request.method == 'GET':
        equipment = Equipment.query.order_by(Equipment.id).all()
        return jsonify([{
            'id': eq.id,
            'name': eq.name,
            'price': eq.price,
            'totalAvailable': eq.total_available,
            'total_available': eq.total_available,
            'isActive': eq.is_active,
            'is_active': eq.is_active,
            'createdAt': eq.created_at.strftime('%Y-%m-%d')
        } for eq in equipment])

    elif request.method == 'POST':
        data = request.get_json(silent=True) or {}
        try:
            validated = EquipmentCreateUpdateSchema.from_input(data)
        except Exception as e:
            return error_response(f"Validation error: {e}", status_code=422)

        if Equipment.query.filter_by(name=validated.name).first():
            return error_response("Equipment item already exists", status_code=409)

        eq = Equipment(
            name=validated.name,
            price=validated.price,
            total_available=validated.total_available,
            is_active=validated.is_active
        )
        db.session.add(eq)
        db.session.commit()
        return success_response(data=eq.to_dict(), message="Equipment added successfully", status_code=201)


@api_bp.route('/admin/equipment/<int:equipment_id>', methods=['PUT', 'DELETE'])
@api_bp.route('/v1/admin/equipment/<int:equipment_id>', methods=['PUT', 'DELETE'])
@admin_required
def manage_single_equipment(equipment_id: int):
    """Update or soft-delete equipment item."""
    eq = Equipment.query.get_or_404(equipment_id)

    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        if 'name' in data and data['name'] != eq.name:
            if Equipment.query.filter(Equipment.name == data['name'], Equipment.id != eq.id).first():
                return error_response("Equipment name already exists", status_code=409)
            eq.name = data['name']

        if 'price' in data:
            eq.price = int(data['price'])
        if 'totalAvailable' in data or 'total_available' in data:
            eq.total_available = int(data.get('totalAvailable') or data.get('total_available'))
        if 'isActive' in data or 'is_active' in data:
            eq.is_active = bool(data.get('isActive') if 'isActive' in data else data.get('is_active'))

        db.session.commit()
        return success_response(data=eq.to_dict(), message="Equipment updated successfully")

    elif request.method == 'DELETE':
        eq.is_active = False
        db.session.commit()
        return success_response(message="Equipment deactivated successfully")


@api_bp.route('/admin/coaches', methods=['GET', 'POST'])
@api_bp.route('/v1/admin/coaches', methods=['GET', 'POST'])
@admin_required
def manage_admin_coaches():
    """List or create coaches."""
    if request.method == 'GET':
        coaches = Coach.query.order_by(Coach.id).all()
        return jsonify([{
            'id': c.id,
            'name': c.name,
            'price': c.price,
            'specialization': c.specialization,
            'isActive': c.is_active,
            'is_active': c.is_active,
            'createdAt': c.created_at.strftime('%Y-%m-%d'),
            'totalBookings': Booking.query.filter_by(coach_id=c.id).count()
        } for c in coaches])

    elif request.method == 'POST':
        data = request.get_json(silent=True) or {}
        try:
            validated = CoachCreateUpdateSchema.from_input(data)
        except Exception as e:
            return error_response(f"Validation error: {e}", status_code=422)

        if Coach.query.filter_by(name=validated.name).first():
            return error_response("Coach already exists", status_code=409)

        coach = Coach(
            name=validated.name,
            price=validated.price,
            specialization=validated.specialization,
            is_active=validated.is_active
        )
        db.session.add(coach)
        db.session.commit()
        return success_response(data=coach.to_dict(), message="Coach registered successfully", status_code=201)


@api_bp.route('/admin/coaches/<int:coach_id>', methods=['PUT', 'DELETE'])
@api_bp.route('/v1/admin/coaches/<int:coach_id>', methods=['PUT', 'DELETE'])
@admin_required
def manage_single_coach(coach_id: int):
    """Update or soft-delete coach."""
    coach = Coach.query.get_or_404(coach_id)

    if request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        if 'name' in data and data['name'] != coach.name:
            if Coach.query.filter(Coach.name == data['name'], Coach.id != coach.id).first():
                return error_response("Coach name already exists", status_code=409)
            coach.name = data['name']

        if 'price' in data:
            coach.price = int(data['price'])
        if 'specialization' in data:
            coach.specialization = data['specialization']
        if 'isActive' in data or 'is_active' in data:
            coach.is_active = bool(data.get('isActive') if 'isActive' in data else data.get('is_active'))

        db.session.commit()
        return success_response(data=coach.to_dict(), message="Coach updated successfully")

    elif request.method == 'DELETE':
        coach.is_active = False
        db.session.commit()
        return success_response(message="Coach deactivated successfully")


@api_bp.route('/admin/pricing-rules', methods=['GET', 'PUT'])
@api_bp.route('/v1/admin/pricing-rules', methods=['GET', 'PUT'])
@admin_required
def manage_admin_pricing_rules():
    """List or update dynamic pricing rules."""
    if request.method == 'GET':
        rules = PricingRule.query.all()
        return jsonify([r.to_dict() for r in rules])

    elif request.method == 'PUT':
        data = request.get_json(silent=True) or {}
        rules_list = data.get('rules', [])
        if not rules_list:
            return error_response("No rules data provided", status_code=400)

        for item in rules_list:
            rule_type = item.get('rule_type') or item.get('ruleType')
            if not rule_type:
                continue

            rule = PricingRule.query.filter_by(rule_type=rule_type).first()
            if not rule:
                rule = PricingRule(rule_type=rule_type)
                db.session.add(rule)

            if 'enabled' in item:
                rule.enabled = bool(item['enabled'])
            if 'multiplier' in item:
                rule.multiplier = float(item['multiplier'])
            if 'startTime' in item or 'start_time' in item:
                rule.start_time = item.get('startTime') or item.get('start_time')
            if 'endTime' in item or 'end_time' in item:
                rule.end_time = item.get('endTime') or item.get('end_time')
            if 'discount' in item:
                rule.discount = float(item['discount'])
            if 'minItems' in item or 'min_items' in item:
                rule.min_items = int(item.get('minItems') or item.get('min_items')) if (item.get('minItems') or item.get('min_items')) is not None else None
            if 'applyDays' in item or 'apply_days' in item:
                rule.apply_days = item.get('applyDays') or item.get('apply_days')

        db.session.commit()
        return success_response(message="Pricing rules updated successfully")


@api_bp.route('/admin/reports/revenue', methods=['GET'])
@api_bp.route('/v1/admin/reports/revenue', methods=['GET'])
@admin_required
def get_revenue_report_endpoint():
    """Generates cross-database financial revenue reports."""
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')

    start_date = None
    end_date = None
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return error_response("Invalid date format in query (expected YYYY-MM-DD)", status_code=400)

    report = AnalyticsService.get_detailed_revenue_report(start_date=start_date, end_date=end_date)
    return jsonify(report)
